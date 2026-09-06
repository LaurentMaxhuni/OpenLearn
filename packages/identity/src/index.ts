export {
  createOidcAuthenticator,
  createSessionAuthenticator,
  createSessionToken,
  sessionClearCookie,
  sessionSetCookie,
} from './authenticator.js';
export type {
  AuthenticationInput,
  ExternalPrincipal,
  JwtKeySource,
  OidcAuthenticatorOptions,
  PrincipalResolver,
  SessionAuthenticatorOptions,
  SessionTokenOptions,
} from './authenticator.js';
export { createStaticPrincipalResolver } from './testing.js';
