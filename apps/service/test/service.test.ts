import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  ActorContext,
  OpenLearnApplication,
} from '@openlearn/application';
import { createService, startStdio } from '../src/index.js';

const actor: ActorContext = {
  ownerId: 'owner-service-test' as ActorContext['ownerId'],
  scopes: ['plan:read', 'plan:write', 'progress:write'],
  actorClass: 'remote_mcp',
};

const application = (calls: string[]): OpenLearnApplication => ({
  createPlanView: async () => {
    calls.push('create');
    return {
      outcome: 'rejected',
      operation: { operationId: 'service-create', state: 'rejected' },
      error: {
        code: 'invalid_input',
        message: 'invalid',
        retryable: false,
      },
    };
  },
  getPlanView: async () => {
    calls.push('get');
    return {
      outcome: 'rejected',
      operation: { operationId: 'service-get', state: 'rejected' },
      error: {
        code: 'unavailable',
        message: 'unavailable',
        retryable: false,
      },
    };
  },
  applyProgressAction: async () => {
    calls.push('progress');
    return {
      outcome: 'rejected',
      operation: { operationId: 'service-progress', state: 'rejected' },
      error: {
        code: 'invalid_input',
        message: 'invalid',
        retryable: false,
      },
    };
  },
});

const serviceFor = (calls: string[]) =>
  createService({
    config: {
      dashboardOrigin: 'https://dashboard.example.test',
      allowedOrigins: ['https://allowed.example.test'],
      host: '127.0.0.1',
      port: 3000,
      mcpPath: '/mcp',
      buildVersion: 'test',
    },
    dependencies: {
      application: application(calls),
      authenticateHttp: async ({ authorization }) => {
        calls.push(`auth:${authorization ?? 'none'}`);
        return actor;
      },
      authenticateStdio: async () => actor,
      operationIds: { next: () => 'service-operation' },
    },
  });

test('exposes liveness and readiness without requiring an MCP session', async () => {
  const calls: string[] = [];
  const service = serviceFor(calls);

  try {
    const live = await service.app.inject({ method: 'GET', url: '/health/live' });
    const ready = await service.app.inject({ method: 'GET', url: '/health/ready' });

    assert.equal(live.statusCode, 200);
    assert.deepEqual(live.json(), { status: 'ok' });
    assert.equal(ready.statusCode, 200);
    assert.deepEqual(ready.json(), { status: 'ok' });
  } finally {
    await service.app.close();
  }
});

test('rejects a disallowed Origin before MCP or application work', async () => {
  const calls: string[] = [];
  const service = serviceFor(calls);

  try {
    const response = await service.app.inject({
      method: 'POST',
      url: '/mcp',
      headers: { origin: 'https://attacker.example.test' },
      payload: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'service-test', version: '1.0.0' },
        },
      },
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.json(), { error: 'origin_not_allowed' });
    assert.deepEqual(calls, []);
  } finally {
    await service.app.close();
  }
});

test('serves an allowed stateless Streamable HTTP initialization request', async () => {
  const calls: string[] = [];
  const service = serviceFor(calls);

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
          clientInfo: { name: 'service-test', version: '1.0.0' },
        },
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['mcp-session-id'], undefined);
    assert.deepEqual(calls, ['auth:none']);
  } finally {
    await service.app.close();
  }
});

test('rejects missing HTTP authentication before constructing an MCP server', async () => {
  const calls: string[] = [];
  const service = createService({
    config: {
      dashboardOrigin: 'https://dashboard.example.test',
      allowedOrigins: ['https://allowed.example.test'],
      host: '127.0.0.1',
      port: 3000,
      mcpPath: '/mcp',
      buildVersion: 'test',
    },
    dependencies: {
      application: application(calls),
      authenticateHttp: async () => undefined,
      authenticateStdio: async () => actor,
      operationIds: { next: () => 'service-operation' },
    },
  });

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
    assert.deepEqual(response.json(), { error: 'unauthorized' });
    assert.deepEqual(calls, []);
  } finally {
    await service.app.close();
  }
});

test('reports readiness failure without exposing dependency details', async () => {
  const calls: string[] = [];
  const service = createService({
    config: {
      dashboardOrigin: 'https://dashboard.example.test',
      allowedOrigins: ['https://allowed.example.test'],
      host: '127.0.0.1',
      port: 3000,
      mcpPath: '/mcp',
      buildVersion: 'test',
    },
    dependencies: {
      application: application(calls),
      authenticateHttp: async () => actor,
      authenticateStdio: async () => actor,
      operationIds: { next: () => 'service-operation' },
    },
    readiness: () => false,
  });

  try {
    const response = await service.app.inject({ method: 'GET', url: '/health/ready' });
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json(), { status: 'not_ready' });
  } finally {
    await service.app.close();
  }
});

test('fails closed when the explicit stdio authenticator cannot resolve an actor', async () => {
  const calls: string[] = [];
  let failed = false;
  try {
    await startStdio({
      application: application(calls),
      authenticateHttp: async () => actor,
      authenticateStdio: async () => undefined,
      operationIds: { next: () => 'service-operation' },
    });
  } catch {
    failed = true;
  }

  assert.equal(failed, true);
  assert.deepEqual(calls, []);
});
