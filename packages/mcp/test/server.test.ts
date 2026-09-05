import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type {
  ActorContext,
  OpenLearnApplication,
  PlanHandoff,
} from '@openlearn/application';
import {
  MCP_CONTRACT_VERSION,
  MCP_MAX_IDEMPOTENCY_KEY_LENGTH,
  MCP_MAX_TIMESTAMP_LENGTH,
  MCP_TOOL_NAMES,
  applyProgressActionInputSchema,
  createPlanViewInputSchema,
  getPlanViewInputSchema,
  createMcpServer,
} from '../src/index.js';

const actor: ActorContext = {
  ownerId: 'owner-mcp-test' as ActorContext['ownerId'],
  scopes: ['plan:read', 'plan:write', 'progress:write'],
  actorClass: 'local_stdio',
};

const handoff: PlanHandoff = {
  planId: 'plan-mcp-test' as PlanHandoff['planId'],
  revisionId: 'revision-mcp-test' as PlanHandoff['revisionId'],
  revisionNumber: 1,
  dashboardUrl: 'https://dashboard.example.test/plans/plan-mcp-test',
};

const successfulApplication = (calls: string[]): OpenLearnApplication => ({
  createPlanView: async (_actor, input) => {
    calls.push(`create:${input.idempotencyKey}`);
    return {
      outcome: 'succeeded',
      operation: { operationId: 'operation-create', state: 'succeeded' },
      value: handoff,
    };
  },
  getPlanView: async (_actor, input) => {
    calls.push(`get:${input.planId}`);
    return {
      outcome: 'rejected',
      operation: { operationId: 'operation-get', state: 'rejected' },
      error: {
        code: 'unavailable',
        message: 'The requested plan is not available.',
        retryable: false,
      },
    };
  },
  applyProgressAction: async (_actor, input) => {
    calls.push(`progress:${input.action}`);
    return {
      outcome: 'succeeded',
      operation: { operationId: 'operation-progress', state: 'succeeded' },
      value: handoff,
    };
  },
});

const connectPair = async (application: OpenLearnApplication) => {
  const calls: string[] = [];
  const server = createMcpServer({
    application,
    actor,
    operationIds: { next: () => 'operation-unauthorized' },
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'openlearn-test-client', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { calls, client, server };
};

test('advertises only the approved tool names and invokes a structured mutation result', async () => {
  const calls: string[] = [];
  const connected = await connectPair(successfulApplication(calls));

  try {
    const tools = await connected.client.listTools();
    assert.deepEqual(
      tools.tools.map((tool) => tool.name).sort(),
      [...MCP_TOOL_NAMES].sort(),
    );
    assert.equal(tools.tools.some((tool) => tool.description?.includes('learner')), false);

    const result = await connected.client.callTool({
      name: 'openlearn.create_plan_view',
      arguments: {
        idempotencyKey: 'mcp-create-1',
        candidate: { goal: 'learn TypeScript' },
        acceptedAt: '2030-01-06T03:04:05Z',
      },
    });

    assert.equal(result.isError, undefined);
    assert.deepEqual(result.structuredContent, {
      contractVersion: MCP_CONTRACT_VERSION,
      outcome: 'succeeded',
      operation: { operationId: 'operation-create', state: 'succeeded' },
      plan: handoff,
    });
    assert.deepEqual(calls, ['create:mcp-create-1']);
  } finally {
    await connected.client.close();
    await connected.server.close();
  }
});

test('filters discovery to the supplied actor scopes before application calls', async () => {
  const calls: string[] = [];
  const server = createMcpServer({
    application: successfulApplication(calls),
    actor: {
      ...actor,
      scopes: ['plan:read'],
      actorClass: 'remote_mcp',
    },
    operationIds: { next: () => 'operation-auth-failure' },
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'openlearn-auth-test-client', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  try {
    const result = await client.callTool({
      name: 'openlearn.get_plan_view',
      arguments: { planId: 'plan-mcp-test' },
    });
    assert.equal(result.isError, true);
    assert.deepEqual(result.structuredContent, {
      contractVersion: MCP_CONTRACT_VERSION,
      outcome: 'rejected',
      operation: { operationId: 'operation-get', state: 'rejected' },
      error: {
        code: 'unavailable',
        message: 'The requested plan is not available.',
        retryable: false,
      },
    });
    assert.deepEqual(calls, ['get:plan-mcp-test']);
    assert.deepEqual(
      (await client.listTools()).tools.map((tool) => tool.name),
      ['openlearn.get_plan_view'],
    );
  } finally {
    await client.close();
    await server.close();
  }
});

test('rejects credential, owner, redirect, identifier, and version fields at the protocol boundary', () => {
  assert.equal(
    createPlanViewInputSchema.safeParse({
      idempotencyKey: 'schema-create',
      candidate: { goal: 'learn' },
      acceptedAt: '2030-01-06T03:04:05Z',
      ownerId: 'owner-selected-by-caller',
    }).success,
    false,
  );
  assert.equal(
    createPlanViewInputSchema.safeParse({
      idempotencyKey: 'schema-create',
      acceptedAt: '2030-01-06T03:04:05Z',
    }).success,
    false,
  );
  assert.equal(
    getPlanViewInputSchema.safeParse({ planId: 'not valid' }).success,
    false,
  );
  assert.equal(
    applyProgressActionInputSchema.safeParse({
      planId: 'plan-schema-test',
      itemId: 'item-schema-test',
      action: 'complete_item',
      expectedRevisionId: 'revision-schema-test',
      expectedProgressVersion: 1.5,
      idempotencyKey: 'schema-progress',
      confirmedAt: '2030-01-06T03:04:05Z',
      redirectUri: 'https://attacker.example.test',
    }).success,
    false,
  );
});

test('bounds protocol strings and candidate collections before application work', () => {
  assert.equal(
    createPlanViewInputSchema.safeParse({
      idempotencyKey: 'a'.repeat(MCP_MAX_IDEMPOTENCY_KEY_LENGTH + 1),
      candidate: { goal: 'learn' },
      acceptedAt: '2030-01-06T03:04:05Z',
    }).success,
    false,
  );
  assert.equal(
    createPlanViewInputSchema.safeParse({
      idempotencyKey: 'bounded',
      candidate: Array.from({ length: 257 }, () => 'value'),
      acceptedAt: '2030-01-06T03:04:05Z',
    }).success,
    false,
  );
  assert.equal(
    createPlanViewInputSchema.safeParse({
      idempotencyKey: 'bounded',
      candidate: { goal: 'learn' },
      acceptedAt: `2030-01-06T03:04:05.${'0'.repeat(MCP_MAX_TIMESTAMP_LENGTH)}Z`,
    }).success,
    false,
  );
});
