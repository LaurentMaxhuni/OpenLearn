import test from 'node:test';
import assert from 'node:assert/strict';
import type { ActorContext, OpenLearnApplication } from '@openlearn/application';
import { MCP_MAX_REQUEST_BYTES } from '@openlearn/mcp';
import { createService } from '../src/index.js';

const actor: ActorContext = {
  ownerId: 'owner-service-security' as ActorContext['ownerId'],
  scopes: ['plan:read'],
  actorClass: 'remote_mcp',
};

const application: OpenLearnApplication = {
  createPlanView: async () => {
    throw new Error('application should not be called');
  },
  getPlanView: async () => ({
    outcome: 'rejected',
    operation: { operationId: 'security-get', state: 'rejected' },
    error: { code: 'unavailable', message: 'unavailable', retryable: false },
  }),
  applyProgressAction: async () => {
    throw new Error('application should not be called');
  },
};

const serviceFor = (authenticateHttp: (input: { authorization?: string; origin?: string }) => ActorContext | undefined) =>
  createService({
    config: {
      dashboardOrigin: 'https://dashboard.example.test',
      allowedOrigins: ['https://allowed.example.test'],
      host: '127.0.0.1',
      port: 3000,
      mcpPath: '/mcp',
      buildVersion: 'security-test',
    },
    dependencies: {
      application,
      authenticateHttp,
      authenticateStdio: async () => actor,
      operationIds: { next: () => 'security-operation' },
    },
  });

test('adds non-caching, framing, referrer, and content-type protections to every response', async () => {
  const service = serviceFor(() => actor);
  try {
    const response = await service.app.inject({ method: 'GET', url: '/health/live' });
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers['content-security-policy'], "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    assert.equal(response.headers['referrer-policy'], 'no-referrer');
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
  } finally {
    await service.app.close();
  }
});

test('rejects oversized request bodies before authentication', async () => {
  let authenticationCalls = 0;
  const service = serviceFor(() => {
    authenticationCalls += 1;
    return actor;
  });
  try {
    const response = await service.app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        origin: 'https://allowed.example.test',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ value: 'x'.repeat(MCP_MAX_REQUEST_BYTES) }),
    });
    assert.equal(response.statusCode, 413);
    assert.equal(authenticationCalls, 0);
    assert.equal(response.headers['cache-control'], 'no-store');
  } finally {
    await service.app.close();
  }
});

test('adds security headers to hijacked MCP responses', async () => {
  const service = serviceFor(() => actor);
  try {
    const response = await service.app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        origin: 'https://allowed.example.test',
        accept: 'application/json, text/event-stream',
      },
      payload: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'security-test', version: '1.0.0' },
        },
      },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers['content-security-policy'], "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    assert.equal(response.headers['referrer-policy'], 'no-referrer');
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
  } finally {
    await service.app.close();
  }
});
