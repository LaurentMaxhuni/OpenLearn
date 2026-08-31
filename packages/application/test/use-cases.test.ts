import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptedNoProgressFixture,
  deletedPlanFixture,
} from '@openlearn/domain';
import {
  createApplication,
  createMemoryApplicationState,
  type ActorContext,
} from '../src/index.js';

const fixture = acceptedNoProgressFixture();
const candidate = (() => {
  const { missingOptionalPaths: _missingOptionalPaths, ...content } = fixture.content;
  return content;
})();

const allocator = () => {
  const counters = new Map<string, number>();
  return {
    allocate(kind: string): string {
      const next = (counters.get(kind) ?? 0) + 1;
      counters.set(kind, next);
      return `application-${kind}-${next.toString().padStart(3, '0')}`;
    },
  };
};

const actor: ActorContext = {
  ownerId: fixture.ownerId,
  scopes: ['plan:read', 'plan:write', 'progress:write'],
  actorClass: 'local_stdio',
};

const otherActor: ActorContext = {
  ownerId: 'owner-other-application' as typeof fixture.ownerId,
  scopes: ['plan:read', 'plan:write', 'progress:write'],
  actorClass: 'remote_mcp',
};

const applicationFor = (state = createMemoryApplicationState()) =>
  createApplication({
    state,
    allocator: allocator(),
    clock: { now: () => new Date('2030-01-06T03:04:05.000Z') },
    operationIds: (() => {
      let next = 0;
      return { next: () => `operation-use-case-${++next}` };
    })(),
    dashboardOrigin: 'https://dashboard.example.test',
  });

test('creates an accepted plan, returns a controlled handoff, and reads its snapshot', async () => {
  const application = applicationFor();
  const created = await application.createPlanView(actor, {
    idempotencyKey: 'use-case-create-1',
    candidate,
    acceptedAt: '2030-01-06T03:04:05Z',
  });

  assert.equal(created.outcome, 'succeeded');
  if (created.value === undefined) {
    throw new Error('expected plan handoff');
  }
  assert.equal(created.value.dashboardUrl, `https://dashboard.example.test/plans/${created.value.planId}`);

  const read = await application.getPlanView(actor, {
    planId: created.value.planId,
  });
  assert.equal(read.outcome, 'succeeded');
  assert.equal(read.value?.planId, created.value.planId);
  assert.equal(read.value?.dashboardUrl, created.value.dashboardUrl);
});

test('replaces a plan only with the expected revision and preserves the handoff contract', async () => {
  const application = applicationFor();
  const created = await application.createPlanView(actor, {
    idempotencyKey: 'use-case-create-2',
    candidate,
    acceptedAt: '2030-01-06T03:04:05Z',
  });
  if (created.value === undefined) {
    throw new Error('expected plan handoff');
  }

  const replaced = await application.createPlanView(actor, {
    idempotencyKey: 'use-case-replace-1',
    candidate,
    acceptedAt: '2030-01-06T03:04:06Z',
    planId: created.value.planId,
    expectedRevisionId: created.value.revisionId,
  });

  assert.equal(replaced.outcome, 'succeeded');
  assert.equal(replaced.value?.revisionNumber, 2);
  assert.equal(replaced.value?.planId, created.value.planId);
});

test('rejects invalid candidates without creating state and hides unauthorized or deleted plans', async () => {
  const state = createMemoryApplicationState();
  const application = applicationFor(state);
  const invalid = await application.createPlanView(actor, {
    idempotencyKey: 'use-case-invalid-1',
    candidate: { goal: { title: '' } },
    acceptedAt: '2030-01-06T03:04:05Z',
  });

  assert.equal(invalid.outcome, 'rejected');
  assert.equal(state.listPlans().length, 0);

  state.seedPlan(fixture);
  const unauthorized = await application.getPlanView(otherActor, {
    planId: fixture.planId,
  });
  assert.equal(unauthorized.outcome, 'rejected');
  assert.equal(unauthorized.error?.code, 'unavailable');
  assert.equal('value' in unauthorized, false);

  state.seedPlan(deletedPlanFixture());
  const deleted = await application.getPlanView(actor, {
    planId: deletedPlanFixture().planId,
  });
  assert.equal(deleted.outcome, 'rejected');
  assert.equal(deleted.error?.code, 'unavailable');
  assert.equal('value' in deleted, false);
});

test('applies a progress action with revision and progress compare-and-set inputs', async () => {
  const application = applicationFor();
  const created = await application.createPlanView(actor, {
    idempotencyKey: 'use-case-create-3',
    candidate,
    acceptedAt: '2030-01-06T03:04:05Z',
  });
  if (created.value === undefined) {
    throw new Error('expected plan handoff');
  }
  const before = await application.getPlanView(actor, { planId: created.value.planId });
  if (before.value?.nextItemId === undefined) {
    throw new Error('expected next item');
  }

  const progress = await application.applyProgressAction(actor, {
    planId: created.value.planId,
    itemId: before.value.nextItemId,
    action: 'start_item',
    expectedRevisionId: created.value.revisionId,
    expectedProgressVersion: 0,
    idempotencyKey: 'use-case-progress-1',
    confirmedAt: '2030-01-06T03:04:07Z',
  });
  assert.equal(progress.outcome, 'succeeded');

  const after = await application.getPlanView(actor, { planId: created.value.planId });
  assert.equal(after.value?.currentProgress[0]?.state, 'in_progress');

  const stale = await application.applyProgressAction(actor, {
    planId: created.value.planId,
    itemId: before.value.nextItemId,
    action: 'complete_item',
    expectedRevisionId: 'stale-revision',
    expectedProgressVersion: 1,
    idempotencyKey: 'use-case-progress-2',
    confirmedAt: '2030-01-06T03:04:08Z',
  });
  assert.equal(stale.outcome, 'conflict');
  assert.equal(stale.error?.code, 'stale_revision');
});
