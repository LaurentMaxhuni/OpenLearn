import test from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT } from 'jose';
import type { ActorContext } from '@openlearn/application';
import {
  createOidcAuthenticator,
  createSessionAuthenticator,
  createSessionToken,
  createStaticPrincipalResolver,
} from '../src/index.js';

const issuer = 'https://issuer.example.test';
const ownerId = 'owner-identity-test' as ActorContext['ownerId'];
const signingKey = new TextEncoder().encode('identity-test-secret-which-is-long-enough');

const jwt = async (claims: Record<string, unknown> = {}) =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(issuer)
    .setSubject('subject-123')
    .setAudience('openlearn-mcp')
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(signingKey);

const resolver = createStaticPrincipalResolver([
  { issuer, subject: 'subject-123', ownerId },
]);

test('maps a verified bearer token to the canonical internal owner and scopes', async () => {
  const authenticate = createOidcAuthenticator({
    issuer,
    audience: 'openlearn-mcp',
    keySet: signingKey,
    resolver,
  });
  const actor = await authenticate({
    authorization: `Bearer ${await jwt({ scope: 'plan:read progress:write unknown:scope' })}`,
  });

  assert.deepEqual(actor, {
    ownerId,
    scopes: ['plan:read', 'progress:write'],
    actorClass: 'remote_mcp',
  });
});

test('fails closed for wrong audience, wrong issuer, missing principal, or required scope', async () => {
  const authenticate = createOidcAuthenticator({
    issuer,
    audience: 'openlearn-mcp',
    keySet: signingKey,
    resolver,
    requiredScopes: ['plan:write'],
  });
  const wrongAudience = await new SignJWT({ scope: 'plan:write' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(issuer)
    .setSubject('subject-123')
    .setAudience('another-resource')
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(signingKey);
  const wrongIssuer = await new SignJWT({ scope: 'plan:write' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('https://other-issuer.example.test')
    .setSubject('subject-123')
    .setAudience('openlearn-mcp')
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(signingKey);

  assert.equal(
    await authenticate({ authorization: `Bearer ${wrongAudience}` }),
    undefined,
  );
  assert.equal(
    await authenticate({ authorization: `Bearer ${wrongIssuer}` }),
    undefined,
  );
  assert.equal(
    await authenticate({ authorization: `Bearer ${await jwt({ scope: 'plan:read' })}` }),
    undefined,
  );
  assert.equal(await authenticate({ authorization: 'Basic not-a-bearer' }), undefined);
});

test('verifies the dashboard session cookie through the same owner resolver', async () => {
  const secret = 'session-secret-which-is-at-least-32-bytes-long';
  const token = await createSessionToken({
    issuer,
    audience: 'openlearn-dashboard',
    subject: 'subject-123',
    secret,
    scopes: ['plan:read', 'plan:write', 'progress:write'],
  });
  const authenticate = createSessionAuthenticator({
    issuer,
    audience: 'openlearn-dashboard',
    secret,
    resolver,
  });
  const actor = await authenticate({
    cookie: `other=value; openlearn_session=${encodeURIComponent(token)}`,
  });

  assert.equal(actor?.ownerId, ownerId);
  assert.equal(actor?.actorClass, 'dashboard_session');
  assert.deepEqual(actor?.scopes, ['plan:read', 'plan:write', 'progress:write']);
  assert.equal(await authenticate({ cookie: 'openlearn_session=malformed' }), undefined);
});
