import test from 'node:test';
import assert from 'node:assert/strict';

import {
  brandIdentifier,
  createPlan,
  replacePlan,
  type ActivePlanAggregate,
  type DomainResult,
  type IdentityAllocator,
  type InternalOwnerId,
  type LearnerProgressRecord,
  type PlanAggregate,
  type PlanItemId,
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
  readonly calls: string[] = [];

  allocate(kind: Parameters<IdentityAllocator['allocate']>[0]): string {
    this.calls.push(kind);
    return `generated-${kind}-${this.calls.length}`;
  }
}

const ownerId = (value: string): InternalOwnerId =>
  expectSuccess(brandIdentifier('internal_owner', value));

const makeCandidate = (itemIds: readonly string[]) => ({
  title: 'Web foundations',
  goal: {
    goalId: 'goal-web-foundations',
    title: 'Learn the foundations of the web',
  },
  milestones: [
    {
      milestoneId: 'milestone-foundations',
      title: 'Understand the browser',
      topics: [
        {
          topicId: 'topic-documents',
          title: 'Documents and structure',
          items: itemIds.map((itemId) => ({
            itemId,
            title: `Study ${itemId}`,
          })),
        },
      ],
    },
  ],
});

const createFixture = (itemIds: readonly string[] = ['item-a', 'item-b']) => {
  const allocator = new TestAllocator();
  const result = createPlan({
    ownerId: ownerId('owner-revisions'),
    candidate: makeCandidate(itemIds),
    allocator,
    acceptedAt: asTimestamp(TEST_TIMESTAMP),
  });

  return {
    allocator,
    plan: expectSuccess(result),
  };
};

const itemIds = (plan: ActivePlanAggregate): readonly PlanItemId[] =>
  plan.content.milestones.flatMap((milestone) =>
    milestone.topics.flatMap((topic) => topic.items.map((item) => item.itemId)),
  );

test('creates an active plan from an accepted normalized snapshot', () => {
  const { allocator, plan } = createFixture();

  assert.equal(plan.lifecycle, 'active');
  assert.equal(plan.currentRevision.revisionNumber, 1);
  assert.equal(plan.currentRevision.revisionId, 'generated-revision-2');
  assert.equal(plan.currentRevision.acceptedAt, TEST_TIMESTAMP);
  assert.equal(plan.content.title, 'Web foundations');
  assert.deepEqual(itemIds(plan), ['item-a', 'item-b']);
  assert.deepEqual(plan.content.missingOptionalPaths, [
    'goal.description',
    'milestones[0].description',
    'milestones[0].topics[0].description',
    'milestones[0].topics[0].items[0].description',
    'milestones[0].topics[0].items[1].description',
  ]);
  assert.deepEqual(plan.progress, []);
  assert.deepEqual(allocator.calls, ['plan', 'revision']);
});

test('does not create an aggregate or allocate aggregate identities when initial content is invalid', () => {
  const allocator = new TestAllocator();
  const result = createPlan({
    ownerId: ownerId('owner-invalid-create'),
    candidate: {},
    allocator,
    acceptedAt: asTimestamp(TEST_TIMESTAMP),
  });

  const failure = expectFailure(result);

  assert.equal(failure.category, 'missing_required');
  assert.deepEqual(allocator.calls, []);
});

test('replaces content with a new revision while preserving progress by stable item identity', () => {
  const { allocator, plan } = createFixture();
  const completedItem: LearnerProgressRecord = {
    ownerId: plan.ownerId,
    planId: plan.planId,
    itemId: expectSuccess(brandIdentifier('plan_item', 'item-b')),
    state: 'completed_by_learner',
    lastNonCompleteState: 'in_progress',
    progressVersion: 2,
    lastConfirmedAt: asTimestamp(TEST_TIMESTAMP),
  };
  const seededPlan: ActivePlanAggregate = {
    ...plan,
    progress: [completedItem],
  };

  const result = replacePlan({
    plan: seededPlan,
    ownerId: seededPlan.ownerId,
    expectedRevisionId: seededPlan.currentRevision.revisionId,
    candidate: makeCandidate(['item-a', 'item-c']),
    allocator,
    acceptedAt: asTimestamp('2030-01-03T03:04:05Z'),
  });
  const replaced = expectSuccess(result);

  assert.equal(replaced.lifecycle, 'active');
  assert.equal(replaced.planId, plan.planId);
  assert.equal(replaced.ownerId, plan.ownerId);
  assert.notEqual(replaced.currentRevision.revisionId, plan.currentRevision.revisionId);
  assert.equal(replaced.currentRevision.revisionNumber, 2);
  assert.equal(replaced.currentRevision.acceptedAt, '2030-01-03T03:04:05Z');
  assert.deepEqual(itemIds(replaced), ['item-a', 'item-c']);
  assert.equal(replaced.progress, seededPlan.progress);
  assert.deepEqual(replaced.progress, [completedItem]);
  assert.equal(
    replaced.progress.some((record) => record.itemId === 'item-c'),
    false,
  );
});

test('retains omitted history so a returning stable item resumes its prior progress', () => {
  const { allocator, plan } = createFixture();
  const completedItem: LearnerProgressRecord = {
    ownerId: plan.ownerId,
    planId: plan.planId,
    itemId: expectSuccess(brandIdentifier('plan_item', 'item-b')),
    state: 'completed_by_learner',
    lastNonCompleteState: 'not_started',
    progressVersion: 1,
    lastConfirmedAt: asTimestamp(TEST_TIMESTAMP),
  };
  const seededPlan: ActivePlanAggregate = {
    ...plan,
    progress: [completedItem],
  };

  const omitted = expectSuccess(
    replacePlan({
      plan: seededPlan,
      ownerId: seededPlan.ownerId,
      expectedRevisionId: seededPlan.currentRevision.revisionId,
      candidate: makeCandidate(['item-a']),
      allocator,
      acceptedAt: asTimestamp('2030-01-03T03:04:05Z'),
    }),
  );

  assert.deepEqual(itemIds(omitted), ['item-a']);
  assert.deepEqual(omitted.progress, [completedItem]);

  const returned = expectSuccess(
    replacePlan({
      plan: omitted,
      ownerId: omitted.ownerId,
      expectedRevisionId: omitted.currentRevision.revisionId,
      candidate: makeCandidate(['item-a', 'item-b']),
      allocator,
      acceptedAt: asTimestamp('2030-01-04T03:04:05Z'),
    }),
  );

  assert.deepEqual(itemIds(returned), ['item-a', 'item-b']);
  assert.deepEqual(returned.progress, [completedItem]);
  assert.equal(returned.progress[0]?.itemId, 'item-b');
});

test('failed replacement leaves the prior aggregate unchanged', () => {
  const { allocator, plan } = createFixture();
  const before: PlanAggregate = structuredClone(plan);

  const result = replacePlan({
    plan,
    ownerId: plan.ownerId,
    expectedRevisionId: plan.currentRevision.revisionId,
    candidate: {},
    allocator,
    acceptedAt: asTimestamp('2030-01-03T03:04:05Z'),
  });
  const failure = expectFailure(result);

  assert.equal(failure.category, 'missing_required');
  assert.deepEqual(plan, before);
});

test('rejects impossible calendar dates in accepted revision timestamps', () => {
  const result = createPlan({
    ownerId: ownerId('owner-invalid-calendar-date'),
    candidate: makeCandidate(['item-calendar-date']),
    allocator: new TestAllocator(),
    acceptedAt: asTimestamp('2030-02-31T03:04:05Z'),
  });

  const failure = expectFailure(result);

  assert.equal(failure.category, 'malformed_input');
  assert.deepEqual(failure.details, [
    { path: 'acceptedAt', code: 'invalid_syntax' },
  ]);
});
