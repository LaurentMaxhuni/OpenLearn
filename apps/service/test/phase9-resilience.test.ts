import test from 'node:test';
import assert from 'node:assert/strict';
import type { ActorContext, OpenLearnApplication } from '@openlearn/application';
import { createService } from '../src/index.js';

const actor: ActorContext = {
  ownerId: 'owner-service-phase9' as ActorContext['ownerId'],
  scopes: ['plan:read'],
  actorClass: 'remote_mcp',
};

const application: OpenLearnApplication = {
  createPlanView: async () => {
    throw new Error('not used');
  },
  getPlanView: async () => {
    throw new Error('not used');
  },
  applyProgressAction: async () => {
    throw new Error('not used');
  },
};

test('converts readiness exceptions to a safe unavailable response', async () => {
  const service = createService({
    config: {
      dashboardOrigin: 'https://dashboard.example.test',
      allowedOrigins: ['https://allowed.example.test'],
      host: '127.0.0.1',
      port: 3000,
      mcpPath: '/mcp',
      buildVersion: 'phase9',
    },
    dependencies: {
      application,
      authenticateHttp: async () => actor,
      authenticateStdio: async () => actor,
      operationIds: { next: () => 'phase9-ready-operation' },
    },
    readiness: async () => {
      throw new Error('private database diagnostic');
    },
  });

  try {
    const response = await service.app.inject({ method: 'GET', url: '/health/ready' });
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json(), { status: 'not_ready' });
    assert.equal(response.body.includes('private database diagnostic'), false);
    assert.equal(response.headers['cache-control'], 'no-store');
  } finally {
    await service.app.close();
  }
});
