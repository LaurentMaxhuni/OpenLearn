import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyProgressAction,
  brandIdentifier,
  createPlan,
  effectiveProgress,
  readOwnedAcceptedSnapshot,
  replacePlan,
  type ActivePlanAggregate,
  type DomainResult,
  type IdentityAllocator,
  type InternalOwnerId,
  type LearnerAction,
  type LearnerProgressRecord,
  type PlanAggregate,
  type PlanItemId,
  type RevisionId,
  type Timestamp,
  type ProgressCommand,
} from '../src/index.js';

const INITIAL_TIMESTAMP = '2030-01-02T03:04:05Z';

const asTimestamp = (value: string): Timestamp => value as Timestamp;

const expectSuccess = <T>(result: DomainResult<T>): T => {
  assert.equal(result.ok, true);
  if (!result.ok) {
    throw new Error(`expected success, received ${result.category}`);
  }

  return result.value;
};

const expectFailure = <T>(result: DomainResult<T>) => {
  assert.equal(result.ok, false);
  if (result.ok) {
    throw new Error('expected failure');
  }

  return result;
};

class TestAllocator implements IdentityAllocator {
  allocate(kind: Parameters<IdentityAllocator['allocate']>[0]): string {
    return `generated-${kind}-1`;
  }
}

const ownerId = (value: string): InternalOwnerId =>
  expectSuccess(brandIdentifier('internal_owner', value));

const itemId = (value: string): PlanItemId =>
  expectSuccess(brandIdentifier('plan_item', value));

const makeCandidate = (itemIds: readonly string[] = ['item-progress']) => ({
  goal: {
    goalId: 'goal-progress',
    title: 'Learn progress transitions',
  },
  milestones: [
    {
      milestoneId: 'milestone-progress',
      title: 'Confirm learning',
      topics: [
        {
          topicId: 'topic-progress',
          title: 'Track an item',
          items: itemIds.map((id) => ({ itemId: id, title: `Study ${id}` })),
        },
      ],
    },
  ],
});

const createFixture = (itemIds: readonly string[] = ['item-progress']) =>
  expectSuccess(
    createPlan({
      ownerId: ownerId('owner-progress'),
      candidate: makeCandidate(itemIds),
      allocator: new TestAllocator(),
      acceptedAt: asTimestamp(INITIAL_TIMESTAMP),
    }),
  );

const command = (
  plan: ActivePlanAggregate,
  action: LearnerAction,
  expectedProgressVersion: number,
  confirmedAt: string,
  overrides: Partial<ProgressCommand> = {},
): ProgressCommand => ({
  plan,
  ownerId: plan.ownerId,
  expectedRevisionId: plan.currentRevision.revisionId,
  itemId: itemId('item-progress'),
  expectedProgressVersion,
  action,
  confirmedAt: asTimestamp(confirmedAt),
  ...overrides,
});

const progressFor = (
  plan: ActivePlanAggregate,
  value: PlanItemId = itemId('item-progress'),
): LearnerProgressRecord => effectiveProgress(plan, value);

test('uses absence as not_started version zero and applies the exact transition matrix', () => {
  const initial = createFixture();

  const absent = progressFor(initial);
  assert.deepEqual(absent, {
    ownerId: initial.ownerId,
    planId: initial.planId,
    itemId: itemId('item-progress'),
    state: 'not_started',
    progressVersion: 0,
    lastConfirmedAt: INITIAL_TIMESTAMP,
  });

  const started = expectSuccess(
    applyProgressAction(
      command(initial, 'start_item', 0, '2030-01-03T03:04:05Z'),
    ),
  );
  assert.equal(progressFor(started).state, 'in_progress');
  assert.equal(progressFor(started).progressVersion, 1);
  assert.equal(progressFor(started).lastConfirmedAt, '2030-01-03T03:04:05Z');

  const completed = expectSuccess(
    applyProgressAction(
      command(started, 'complete_item', 1, '2030-01-04T03:04:05Z'),
    ),
  );
  assert.deepEqual(progressFor(completed), {
    ownerId: completed.ownerId,
    planId: completed.planId,
    itemId: itemId('item-progress'),
    state: 'completed_by_learner',
    lastNonCompleteState: 'in_progress',
    progressVersion: 2,
    lastConfirmedAt: '2030-01-04T03:04:05Z',
  });

  const undone = expectSuccess(
    applyProgressAction(
      command(completed, 'undo_completion', 2, '2030-01-05T03:04:05Z'),
    ),
  );
  assert.equal(progressFor(undone).state, 'in_progress');
  assert.equal(progressFor(undone).progressVersion, 3);
  assert.equal('lastNonCompleteState' in progressFor(undone), false);
});

test('undoes direct completion back to not_started and rejects disallowed source states', () => {
  const initial = createFixture();
  const completed = expectSuccess(
    applyProgressAction(
      command(initial, 'complete_item', 0, '2030-01-03T03:04:05Z'),
    ),
  );

  const undone = expectSuccess(
    applyProgressAction(
      command(completed, 'undo_completion', 1, '2030-01-04T03:04:05Z'),
    ),
  );
  assert.equal(progressFor(undone).state, 'not_started');
  assert.equal(progressFor(undone).progressVersion, 2);

  const startAgain = expectSuccess(
    applyProgressAction(
      command(undone, 'start_item', 2, '2030-01-05T03:04:05Z'),
    ),
  );
  const startFailure = expectFailure(
    applyProgressAction(
      command(startAgain, 'start_item', 3, '2030-01-06T03:04:05Z'),
    ),
  );
  assert.equal(startFailure.category, 'invalid_transition');

  const completedAgain = expectSuccess(
    applyProgressAction(
      command(startAgain, 'complete_item', 3, '2030-01-07T03:04:05Z'),
    ),
  );
  const completeFailure = expectFailure(
    applyProgressAction(
      command(completedAgain, 'complete_item', 4, '2030-01-08T03:04:05Z'),
    ),
  );
  assert.equal(completeFailure.category, 'invalid_transition');

  const undoAgain = expectSuccess(
    applyProgressAction(
      command(completedAgain, 'undo_completion', 4, '2030-01-09T03:04:05Z'),
    ),
  );
  const undoFailure = expectFailure(
    applyProgressAction(
      command(undoAgain, 'undo_completion', 5, '2030-01-10T03:04:05Z'),
    ),
  );
  assert.equal(undoFailure.category, 'invalid_transition');
});

test('updates an existing record in place and appends a new record without disturbing other progress', () => {
  const initial = createFixture(['item-progress', 'item-second']);
  const second = itemId('item-second');
  const started = expectSuccess(
    applyProgressAction(
      command(initial, 'start_item', 0, '2030-01-03T03:04:05Z', {
        itemId: second,
      }),
    ),
  );

  assert.deepEqual(started.progress.map((record) => record.itemId), [second]);
  assert.equal(progressFor(started, second).state, 'in_progress');
  assert.equal(progressFor(started).state, 'not_started');
});

test('rejects stale revision, stale progress, invalid membership, deletion, and owner failures atomically', () => {
  const initial = createFixture(['item-progress', 'item-second']);
  const before = structuredClone(initial);

  const staleRevision = expectFailure(
    applyProgressAction(
      command(initial, 'start_item', 0, '2030-01-03T03:04:05Z', {
        expectedRevisionId: 'stale-revision' as RevisionId,
      }),
    ),
  );
  assert.equal(staleRevision.category, 'stale_revision');
  assert.deepEqual(initial, before);

  const staleProgress = expectFailure(
    applyProgressAction(
      command(initial, 'start_item', 8, '2030-01-03T03:04:05Z'),
    ),
  );
  assert.equal(staleProgress.category, 'stale_progress');
  assert.equal(staleProgress.details[0]?.expectedVersion, 8);
  assert.equal(staleProgress.details[0]?.actualVersion, 0);
  assert.deepEqual(initial, before);

  const unknownItem = expectFailure(
    applyProgressAction(
      command(initial, 'start_item', 0, '2030-01-03T03:04:05Z', {
        itemId: itemId('not-current'),
      }),
    ),
  );
  assert.equal(unknownItem.category, 'invalid_relationship');
  assert.deepEqual(initial, before);

  const deletedPlan: PlanAggregate = {
    ownerId: initial.ownerId,
    planId: initial.planId,
    lifecycle: 'deleted',
    progress: initial.progress,
    tombstone: {
      planId: initial.planId,
      ownerId: initial.ownerId,
      deletedAt: asTimestamp('2030-01-03T03:04:05Z'),
      terminalRevision: initial.currentRevision,
    },
  };
  const deletedFailure = expectFailure(
    applyProgressAction(
      command({ ...initial, lifecycle: 'active' }, 'start_item', 0, '2030-01-03T03:04:05Z', {
        plan: deletedPlan,
      }),
    ),
  );
  assert.equal(deletedFailure.category, 'plan_deleted');

  const ownerFailure = expectFailure(
    applyProgressAction(
      command(initial, 'start_item', 0, '2030-01-03T03:04:05Z', {
        ownerId: ownerId('owner-other'),
      }),
    ),
  );
  assert.equal(ownerFailure.category, 'owner_unavailable');
  assert.deepEqual(initial, before);
});

test('rejects omitted items and malformed confirmation timestamps without changing the plan', () => {
  const initial = createFixture(['item-progress', 'item-second']);
  const omitted = expectSuccess(
    replacePlan({
      plan: initial,
      ownerId: initial.ownerId,
      expectedRevisionId: initial.currentRevision.revisionId,
      candidate: makeCandidate(['item-progress']),
      allocator: new TestAllocator(),
      acceptedAt: asTimestamp('2030-01-03T03:04:05Z'),
    }),
  );
  const before = structuredClone(omitted);

  const omittedFailure = expectFailure(
    applyProgressAction(
      command(omitted, 'start_item', 0, '2030-01-04T03:04:05Z', {
        itemId: itemId('item-second'),
      }),
    ),
  );
  assert.equal(omittedFailure.category, 'invalid_relationship');
  assert.deepEqual(omitted, before);

  const malformedTimestamp = expectFailure(
    applyProgressAction(
      command(omitted, 'start_item', 0, 'not-a-timestamp'),
    ),
  );
  assert.equal(malformedTimestamp.category, 'malformed_input');
  assert.equal(malformedTimestamp.details[0]?.path, 'confirmedAt');
  assert.deepEqual(omitted, before);
});

test('rejects aggregates whose embedded progress belongs to another owner or plan', () => {
  const initial = createFixture();
  const foreignProgress: LearnerProgressRecord = {
    ownerId: ownerId('owner-foreign-progress'),
    planId: expectSuccess(brandIdentifier('plan', 'plan-foreign-progress')),
    itemId: itemId('item-progress'),
    state: 'completed_by_learner',
    lastNonCompleteState: 'not_started',
    progressVersion: 4,
    lastConfirmedAt: asTimestamp('2030-01-03T03:04:05Z'),
  };
  const malformedPlan: ActivePlanAggregate = {
    ...initial,
    progress: [foreignProgress],
  };

  assert.equal(effectiveProgress(malformedPlan, itemId('item-progress')).state, 'not_started');

  const snapshotFailure = expectFailure(
    readOwnedAcceptedSnapshot(malformedPlan, malformedPlan.ownerId),
  );
  assert.equal(snapshotFailure.category, 'malformed_input');
  assert.equal(JSON.stringify(snapshotFailure).includes('foreign'), false);

  const before = structuredClone(malformedPlan);
  const actionFailure = expectFailure(
    applyProgressAction(
      command(malformedPlan, 'complete_item', 0, '2030-01-04T03:04:05Z'),
    ),
  );
  assert.equal(actionFailure.category, 'malformed_input');
  assert.deepEqual(malformedPlan, before);
});
