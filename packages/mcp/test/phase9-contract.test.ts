import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { ActorContext, OpenLearnApplication } from '@openlearn/application';
import { MCP_CONTRACT_VERSION, createMcpServer } from '../src/index.js';

const actor: ActorContext = {
  ownerId: 'owner-mcp-phase9' as ActorContext['ownerId'],
  scopes: ['plan:read'],
  actorClass: 'remote_mcp',
};

const failingApplication: OpenLearnApplication = {
  createPlanView: async () => {
    throw new Error('secret candidate details must not escape');
  },
  getPlanView: async () => {
    throw new Error('secret plan details must not escape');
  },
  applyProgressAction: async () => {
    throw new Error('secret progress details must not escape');
  },
};

test('maps unexpected application failures to the bounded MCP error envelope', async () => {
  const server = createMcpServer({
    application: failingApplication,
    actor,
    operationIds: { next: () => 'phase9-internal-operation' },
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'phase9-contract-client', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  try {
    const result = await client.callTool({
      name: 'openlearn.get_plan_view',
      arguments: { planId: 'phase9-plan' },
    });
    assert.equal(result.isError, true);
    assert.deepEqual(result.structuredContent, {
      contractVersion: MCP_CONTRACT_VERSION,
      outcome: 'failed_retryable',
      operation: {
        operationId: 'phase9-internal-operation',
        state: 'failed_retryable',
      },
      error: {
        code: 'internal_failure',
        message: 'The request could not be completed. Try again later.',
        retryable: true,
      },
    });
    assert.equal(JSON.stringify(result.structuredContent).includes('secret'), false);
  } finally {
    await client.close();
    await server.close();
  }
});
