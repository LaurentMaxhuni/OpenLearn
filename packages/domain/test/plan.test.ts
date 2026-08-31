import test from 'node:test';
import assert from 'node:assert/strict';

import {
  brandIdentifier,
  createPlan,
  replacePlan,
  type ActivePlanAggregate,
  type DeletedPlanAggregate,
  type DomainResult,
  type IdentityAllocator,
  type InternalOwnerId,
  type LearnerProgressRecord,
  type PlanAggregate,
  type RevisionId,
  type Timestamp,
} from '../src/index.js';

const TEST_TIMESTAMP = '2030-01-02T03:04:05Z';

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

const makeCandidate = () => ({
  goal: {
    goalId: 'goal-plan-guards',
    title: 'Learn plan guards',
  },
  milestones: [
    {
      milestoneId: 'milestone-plan-guards',
      title: 'Use the plan safely',
      topics: [
        {
          topicId: 'topic-plan-guards',
          title: 'Revision checks',
          items: [
            {
              itemId: 'item-plan-guards',
              title: 'Check a revision',
            },
          ],
        },
      ],
    },
  ],
});

const createFixture = () =>
  expectSuccess(
    createPlan({
      ownerId: ownerId('owner-plan-guards'),
      candidate: makeCandidate(),
      allocator: new TestAllocator(),
      acceptedAt: asTimestamp(TEST_TIMESTAMP),
    }),
  );

const unchangedAfterFailure = (
  result: DomainResult<PlanAggregate>,
  category: string,
) => {
  const failure = expectFailure(result);
  assert.equal(failure.category, category);
  return failure;
};

test('rejects a missing expected revision as a stale update', () => {
  const plan = createFixture();
  const before = structuredClone(plan);

  const failure = unchangedAfterFailure(
    replacePlan({
      plan,
      ownerId: plan.ownerId,
      candidate: makeCandidate(),
      allocator: new TestAllocator(),
      acceptedAt: asTimestamp(TEST_TIMESTAMP),
    }),
    'stale_revision',
  );

  assert.equal(failure.details[0]?.code, 'stale_revision');
  assert.deepEqual(plan, before);
});

test('rejects a mismatched expected revision without disclosing current state', () => {
  const plan = createFixture();
  const before = structuredClone(plan);

  const failure = unchangedAfterFailure(
    replacePlan({
      plan,
      ownerId: plan.ownerId,
      expectedRevisionId: 'stale-revision' as RevisionId,
      candidate: makeCandidate(),
      allocator: new TestAllocator(),
      acceptedAt: asTimestamp(TEST_TIMESTAMP),
    }),
    'stale_revision',
  );

  assert.equal(failure.details.some((detail) => detail.path === 'currentRevision'), false);
  assert.equal(failure.details.some((detail) => detail.code === 'stale_revision'), true);
  assert.deepEqual(plan, before);
});

test('rejects replacement by a different owner as unavailable', () => {
  const plan = createFixture();
  const before = structuredClone(plan);

  const failure = unchangedAfterFailure(
    replacePlan({
      plan,
      ownerId: ownerId('owner-not-authorized'),
      expectedRevisionId: plan.currentRevision.revisionId,
      candidate: makeCandidate(),
      allocator: new TestAllocator(),
      acceptedAt: asTimestamp(TEST_TIMESTAMP),
    }),
    'owner_unavailable',
  );

  assert.equal(failure.details[0]?.code, 'owner_unavailable');
  assert.equal(failure.details.some((detail) => detail.path === 'ownerId'), false);
  assert.deepEqual(plan, before);
});

test('rejects replacement of a deleted plan', () => {
  const activePlan = createFixture();
  const deletedPlan: DeletedPlanAggregate = {
    ownerId: activePlan.ownerId,
    planId: activePlan.planId,
    lifecycle: 'deleted',
    progress: activePlan.progress,
    tombstone: {
      planId: activePlan.planId,
      ownerId: activePlan.ownerId,
      deletedAt: asTimestamp(TEST_TIMESTAMP),
      terminalRevision: activePlan.currentRevision,
    },
  };

  const failure = expectFailure(
    replacePlan({
      plan: deletedPlan,
      ownerId: deletedPlan.ownerId,
      expectedRevisionId: activePlan.currentRevision.revisionId,
      candidate: makeCandidate(),
      allocator: new TestAllocator(),
      acceptedAt: asTimestamp(TEST_TIMESTAMP),
    }),
  );

  assert.equal(failure.category, 'plan_deleted');
  assert.equal(failure.details[0]?.code, 'plan_deleted');
});

test('rejects malformed accepted timestamps before accepting a revision', () => {
  const result = createPlan({
    ownerId: ownerId('owner-malformed-time'),
    candidate: makeCandidate(),
    allocator: new TestAllocator(),
    acceptedAt: asTimestamp('not-a-timestamp'),
  });

  const failure = expectFailure(result);

  assert.equal(failure.category, 'malformed_input');
  assert.equal(failure.details[0]?.path, 'acceptedAt');
  assert.equal(failure.details[0]?.code, 'invalid_syntax');
});

test('rejects replacement when embedded progress belongs to another owner or plan', () => {
  const plan = createFixture();
  const foreignProgress: LearnerProgressRecord = {
    ownerId: ownerId('owner-foreign-replacement'),
    planId: expectSuccess(brandIdentifier('plan', 'plan-foreign-replacement')),
    itemId: expectSuccess(brandIdentifier('plan_item', 'item-plan-guards')),
    state: 'completed_by_learner',
    lastNonCompleteState: 'not_started',
    progressVersion: 1,
    lastConfirmedAt: asTimestamp(TEST_TIMESTAMP),
  };
  const malformedPlan: ActivePlanAggregate = {
    ...plan,
    progress: [foreignProgress],
  };
  const before = structuredClone(malformedPlan);

  const failure = expectFailure(
    replacePlan({
      plan: malformedPlan,
      ownerId: malformedPlan.ownerId,
      expectedRevisionId: malformedPlan.currentRevision.revisionId,
      candidate: makeCandidate(),
      allocator: new TestAllocator(),
      acceptedAt: asTimestamp('2030-01-03T03:04:05Z'),
    }),
  );

  assert.equal(failure.category, 'malformed_input');
  assert.deepEqual(malformedPlan, before);
});
