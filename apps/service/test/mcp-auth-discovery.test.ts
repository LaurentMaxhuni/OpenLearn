import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  ActorContext,
  OpenLearnApplication,
} from '@openlearn/application';
import { createService, serviceConfigFromEnv } from '../src/index.js';

const actor: ActorContext = {
  ownerId: 'owner-auth-discovery-test' as ActorContext['ownerId'],
  scopes: ['plan:read', 'plan:write', 'progress:write'],
  actorClass: 'remote_mcp',
};

const application: OpenLearnApplication = {
  createPlanView: async () => ({
    outcome: 'rejected',
    operation: { operationId: 'auth-create', state: 'rejected' },
    error: { code: 'invalid_input', message: 'invalid', retryable: false },
  }),
  getPlanView: async () => ({
    outcome: 'rejected',
    operation: { operationId: 'auth-get', state: 'rejected' },
    error: { code: 'unavailable', message: 'unavailable', retryable: false },
  }),
  applyProgressAction: async () => ({
    outcome: 'rejected',
    operation: { operationId: 'auth-progress', state: 'rejected' },
    error: { code: 'invalid_input', message: 'invalid', retryable: false },
  }),
};

const serviceFor = (
  authenticateHttp: Parameters<typeof createService>[0]['dependencies']['authenticateHttp'],
) => createService({
  config: {
    dashboardOrigin: 'https://dashboard.example.test',
    allowedOrigins: ['https://allowed.example.test'],
    host: '127.0.0.1',
    port: 3000,
    mcpPath: '/mcp',
    buildVersion: 'auth-discovery-test',
    mcpResourceOrigin: 'https://learn.example.test',
    mcpAuthorizationServer: 'https://identity.example.test',
  },
  dependencies: {
    application,
    authenticateHttp,
    authenticateStdio: async () => actor,
    operationIds: { next: () => 'auth-discovery-operation' },
  },
});

test('publishes protected-resource metadata for the hosted MCP endpoint', async () => {
  const service = serviceFor(async () => actor);

  try {
    const response = await service.app.inject({
      method: 'GET',
      url: '/.well-known/oauth-protected-resource',
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      resource: 'https://learn.example.test',
      authorization_servers: ['https://identity.example.test'],
      scopes_supported: ['plan:read', 'plan:write', 'progress:write'],
    });
  } finally {
    await service.app.close();
  }
});

test('advertises protected-resource metadata in an unauthenticated MCP challenge', async () => {
  const service = serviceFor(async () => undefined);

  try {
    const response = await service.app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        origin: 'https://allowed.example.test',
        accept: 'application/json, text/event-stream',
      },
      payload: { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
    });

    assert.equal(response.statusCode, 401);
    assert.equal(
      response.headers['www-authenticate'],
      'Bearer resource_metadata="https://learn.example.test/.well-known/oauth-protected-resource"',
    );
    assert.deepEqual(response.json(), { error: 'unauthorized' });
  } finally {
    await service.app.close();
  }
});

test('reads hosted MCP metadata settings from environment', () => {
  const config = serviceConfigFromEnv({
    OPENLEARN_DASHBOARD_ORIGIN: 'https://dashboard.example.test',
    OPENLEARN_ALLOWED_ORIGINS: 'https://allowed.example.test',
    OPENLEARN_MCP_RESOURCE_ORIGIN: 'https://learn.example.test',
    OPENLEARN_MCP_AUTHORIZATION_SERVER: 'https://identity.example.test',
  });

  assert.equal(config.mcpResourceOrigin, 'https://learn.example.test');
  assert.equal(config.mcpAuthorizationServer, 'https://identity.example.test');
});
