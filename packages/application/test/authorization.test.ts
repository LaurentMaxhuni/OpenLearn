import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptedNoProgressFixture } from '@openlearn/domain';
import {
  createApplication,
  type ApplicationStatePort,
  type ActorContext,
} from '../src/index.js';

const fixture = acceptedNoProgressFixture();
const candidate = (() => {
  const { missingOptionalPaths: _missingOptionalPaths, ...content } = fixture.content;
  return content;
})();

const dependenciesFor = (state: ApplicationStatePort) => ({
  state,
  allocator: {
    allocate: (kind: string) => `application-${kind}-001`,
  },
  clock: { now: () => new Date('2030-01-06T03:04:05.000Z') },
  operationIds: { next: () => 'operation-auth-1' },
  dashboardOrigin: 'https://dashboard.example.test',
});

const actor = (scopes: ActorContext['scopes']): ActorContext => ({
  ownerId: fixture.ownerId,
  scopes,
  actorClass: 'remote_mcp',
});

const untouchedState = (calls: string[]): ApplicationStatePort => ({
  readPlan: async () => {
    calls.push('readPlan');
    return undefined;
  },
  reserveOperation: async () => {
    calls.push('reserveOperation');
    throw new Error('authorization should stop before reservation');
  },
  runMutation: async () => {
    calls.push('runMutation');
    throw new Error('authorization should stop before mutation');
  },
  findMutationReference: async () => {
    calls.push('findMutationReference');
    return undefined;
  },
});

test('rejects plan creation before state access when plan write scope is absent', async () => {
  const calls: string[] = [];
  const application = createApplication(dependenciesFor(untouchedState(calls)));

  const result = await application.createPlanView(
    actor(['plan:read']),
    {
      idempotencyKey: 'auth-key-1',
      candidate,
      acceptedAt: '2030-01-06T03:04:05Z',
    },
  );

  assert.equal(result.outcome, 'rejected');
  assert.equal(result.error?.code, 'missing_capability');
  assert.deepEqual(calls, []);
  assert.equal('value' in result, false);
});

test('rejects reads and progress actions before state access without their scopes', async () => {
  const calls: string[] = [];
  const application = createApplication(dependenciesFor(untouchedState(calls)));

  const read = await application.getPlanView(actor([]), {
    planId: fixture.planId,
  });
  const progress = await application.applyProgressAction(
    actor(['plan:read']),
    {
      planId: fixture.planId,
      itemId: 'fixture-item-reading',
      action: 'complete_item',
      expectedRevisionId: fixture.currentRevision.revisionId,
      expectedProgressVersion: 0,
      idempotencyKey: 'auth-key-2',
      confirmedAt: '2030-01-06T03:04:05Z',
    },
  );

  assert.equal(read.error?.code, 'missing_capability');
  assert.equal(progress.error?.code, 'missing_capability');
  assert.deepEqual(calls, []);
});
