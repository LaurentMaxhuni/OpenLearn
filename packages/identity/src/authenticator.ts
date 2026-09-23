import {
  createRemoteJWKSet,
  jwtVerify,
  SignJWT,
  type JWTPayload,
  type JWTVerifyGetKey,
  type JWTVerifyOptions,
  type JWTVerifyResult,
  type KeyInput,
} from 'jose';
import type {
  ActorClass,
  ActorContext,
  CapabilityScope,
} from '@openlearn/application';
import { CAPABILITY_SCOPES } from '@openlearn/application';
import type { InternalOwnerId } from '@openlearn/domain';

export interface ExternalPrincipal {
  readonly issuer: string;
  readonly subject: string;
}

export interface PrincipalResolver {
  resolve(principal: ExternalPrincipal): Promise<InternalOwnerId | undefined>;
}

export interface AuthenticationInput {
  readonly authorization?: string;
  readonly cookie?: string;
  readonly origin?: string;
  readonly method?: string;
}

export type JwtKeySource = KeyInput | JWTVerifyGetKey;

export interface OidcAuthenticatorOptions {
  readonly issuer: string;
  readonly audience: string | readonly string[];
  readonly jwksUrl?: string;
  readonly keySet?: JwtKeySource;
  readonly resolver: PrincipalResolver;
  readonly requiredScopes?: readonly CapabilityScope[];
  readonly actorClass?: Extract<ActorClass, 'remote_mcp' | 'dashboard_session'>;
  readonly clockToleranceSeconds?: number;
}

export interface SessionAuthenticatorOptions {
  readonly issuer: string;
  readonly audience: string | readonly string[];
  readonly secret: string | Uint8Array;
  readonly resolver: PrincipalResolver;
  readonly requiredScopes?: readonly CapabilityScope[];
  readonly clockToleranceSeconds?: number;
}

export interface SessionTokenOptions {
  readonly issuer: string;
  readonly audience: string;
  readonly subject: string;
  readonly secret: string | Uint8Array;
  readonly scopes?: readonly CapabilityScope[];
  readonly expiresInSeconds?: number;
}

const textEncoder = new TextEncoder();

const secretBytes = (secret: string | Uint8Array): Uint8Array => {
  const bytes = typeof secret === 'string' ? textEncoder.encode(secret) : secret;
  if (bytes.byteLength < 32) {
    throw new Error('Identity signing secrets must contain at least 32 bytes.');
  }
  return bytes;
};

const canonicalIssuer = (value: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Identity issuer must be a valid URL.');
  }
  const localHttp =
    parsed.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if (
    (parsed.protocol !== 'https:' && !localHttp) ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.search !== '' ||
    parsed.hash !== ''
  ) {
    throw new Error('Identity issuer must use HTTPS or a local HTTP URL.');
  }
  const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/u, '');
  return `${parsed.origin}${path}`;
};

const audienceValues = (
  value: string | readonly string[],
): string[] => {
  const values = typeof value === 'string' ? [value] : [...value];
  if (values.length === 0 || values.some((entry) => entry.trim().length === 0)) {
    throw new Error('Identity audience must not be empty.');
  }
  return values;
};

const tokenFromAuthorization = (authorization: string | undefined): string | undefined => {
  if (authorization === undefined) return undefined;
  const match = /^Bearer ([^\s]+)$/u.exec(authorization.trim());
  const token = match?.[1];
  return token === undefined || token.length > 16_384 ? undefined : token;
};

const cookieValue = (
  cookieHeader: string | undefined,
  name: string,
): string | undefined => {
  if (cookieHeader === undefined || cookieHeader.length > 32_768) return undefined;
  let found: string | undefined;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    if (found !== undefined) return undefined;
    try {
      found = decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return found;
};

const scopesFromClaims = (payload: JWTPayload): readonly CapabilityScope[] => {
  const values: string[] = [];
  if (typeof payload.scope === 'string') {
    values.push(...payload.scope.split(/\s+/u).filter((value) => value.length > 0));
  }
  const scp = payload.scp;
  if (Array.isArray(scp)) {
    values.push(...scp.filter((value): value is string => typeof value === 'string'));
  } else if (typeof scp === 'string') {
    values.push(...scp.split(/\s+/u).filter((value) => value.length > 0));
  }
  const supplied = new Set(values);
  return CAPABILITY_SCOPES.filter((scope) => supplied.has(scope));
};

const scopeRequirementsMet = (
  scopes: readonly CapabilityScope[],
  requiredScopes: readonly CapabilityScope[] | undefined,
): boolean => {
  if (requiredScopes === undefined) return true;
  return requiredScopes.every((scope) => scopes.includes(scope));
};

const principalFromClaims = (
  payload: JWTPayload,
  issuer: string,
): ExternalPrincipal | undefined => {
  if (payload.iss !== issuer || typeof payload.sub !== 'string') return undefined;
  if (payload.sub.length === 0 || payload.sub.length > 512) return undefined;
  return { issuer, subject: payload.sub };
};

const actorFromVerifiedClaims = async (
  payload: JWTPayload,
  issuer: string,
  resolver: PrincipalResolver,
  requiredScopes: readonly CapabilityScope[] | undefined,
  actorClass: Extract<ActorClass, 'remote_mcp' | 'dashboard_session'>,
): Promise<ActorContext | undefined> => {
  const principal = principalFromClaims(payload, issuer);
  if (principal === undefined) return undefined;
  const scopes = scopesFromClaims(payload);
  if (!scopeRequirementsMet(scopes, requiredScopes)) return undefined;
  const ownerId = await resolver.resolve(principal);
  if (ownerId === undefined) return undefined;
  return { ownerId, scopes, actorClass };
};

const verifyOptions = (
  issuer: string,
  audience: string[],
  clockToleranceSeconds: number | undefined,
): JWTVerifyOptions => ({
  issuer,
  audience,
  ...(clockToleranceSeconds === undefined
    ? {}
    : { clockTolerance: clockToleranceSeconds }),
});

const verifyJwt = (
  token: string,
  keySet: JwtKeySource,
  options: JWTVerifyOptions,
): Promise<JWTVerifyResult> =>
  (jwtVerify as unknown as (
    token: string,
    keySet: JwtKeySource,
    options: JWTVerifyOptions,
  ) => Promise<JWTVerifyResult>)(token, keySet, options);

/** Verify a standards-based OIDC/OAuth bearer token before application work. */
export const createOidcAuthenticator = (
  options: OidcAuthenticatorOptions,
): ((input: AuthenticationInput) => Promise<ActorContext | undefined>) => {
  const issuer = canonicalIssuer(options.issuer);
  const audience = audienceValues(options.audience);
  const keySet = options.keySet ?? (
    options.jwksUrl === undefined
      ? (() => {
          throw new Error('jwksUrl or keySet is required for OIDC authentication.');
        })()
      : createRemoteJWKSet(new URL(options.jwksUrl))
  );
  const actorClass = options.actorClass ?? 'remote_mcp';
  return async (input) => {
    const token = tokenFromAuthorization(input.authorization);
    if (token === undefined) return undefined;
    try {
      const verified = await verifyJwt(
        token,
        keySet,
        verifyOptions(issuer, audience, options.clockToleranceSeconds),
      );
      return await actorFromVerifiedClaims(
        verified.payload,
        issuer,
        options.resolver,
        options.requiredScopes,
        actorClass,
      );
    } catch {
      return undefined;
    }
  };
};

/** Verify the short-lived, HttpOnly dashboard session cookie. */
export const createSessionAuthenticator = (
  options: SessionAuthenticatorOptions,
): ((input: AuthenticationInput) => Promise<ActorContext | undefined>) => {
  const issuer = canonicalIssuer(options.issuer);
  const audience = audienceValues(options.audience);
  const secret = secretBytes(options.secret);
  return async (input) => {
    const token = cookieValue(input.cookie, 'openlearn_session');
    if (token === undefined || token.length > 16_384) return undefined;
    try {
      const verified = await verifyJwt(
        token,
        secret,
        verifyOptions(issuer, audience, options.clockToleranceSeconds),
      );
      return await actorFromVerifiedClaims(
        verified.payload,
        issuer,
        options.resolver,
        options.requiredScopes,
        'dashboard_session',
      );
    } catch {
      return undefined;
    }
  };
};

export const createSessionToken = async (
  options: SessionTokenOptions,
): Promise<string> => {
  const issuer = canonicalIssuer(options.issuer);
  if (options.subject.length === 0 || options.subject.length > 512) {
    throw new Error('Session subject is outside the supported bounds.');
  }
  const expiresInSeconds = options.expiresInSeconds ?? 8 * 60 * 60;
  if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 60 || expiresInSeconds > 24 * 60 * 60) {
    throw new Error('Session lifetime must be between 60 seconds and 24 hours.');
  }
  const scopes = options.scopes ?? [
    'plan:read',
    'plan:write',
    'progress:write',
    'personalization:read',
    'personalization:write',
  ];
  return new SignJWT({ scope: scopes.join(' ') })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(issuer)
    .setSubject(options.subject)
    .setAudience(options.audience)
    .setIssuedAt()
    .setExpirationTime(`${expiresInSeconds}s`)
    .sign(secretBytes(options.secret));
};

export const sessionSetCookie = (
  token: string,
  maxAgeSeconds = 8 * 60 * 60,
): string => {
  if (token.length === 0 || token.length > 16_384) {
    throw new Error('Session token is outside the supported bounds.');
  }
  return [
    `openlearn_session=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ].join('; ');
};

export const sessionClearCookie = (): string =>
  'openlearn_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
