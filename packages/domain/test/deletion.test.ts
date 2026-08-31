import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deletePlan,
  replacePlan,
  brandIdentifier,
  createPlan,
  type DeletedPlanAggregate,
  type DomainResult,
  type IdentityAllocator,
  type InternalOwnerId,
  type RevisionId,
  type Timestamp,
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

const makeCandidate = () => ({
  goal: { goalId: 'goal-delete', title: 'Learn deletion safely' },
  milestones: [
    {
      milestoneId: 'milestone-delete',
      title: 'Control the plan',
      topics: [
        {
          topicId: 'topic-delete',
          title: 'Delete deliberately',
          items: [{ itemId: 'item-delete', title: 'Confirm deletion' }],
        },
      ],
    },
  ],
});

const createFixture = () =>
  expectSuccess(
    createPlan({
      ownerId: ownerId('owner-delete'),
      candidate: makeCandidate(),
      allocator: new TestAllocator(),
      acceptedAt: asTimestamp(INITIAL_TIMESTAMP),
    }),
  );

test('deletes an active plan into an immediately inaccessible tombstone state', () => {
  const active = createFixture();

  const deleted = expectSuccess(
    deletePlan({
      plan: active,
      ownerId: active.ownerId,
      expectedRevisionId: active.currentRevision.revisionId,
      deletedAt: asTimestamp('2030-01-03T03:04:05Z'),
    }),
  );

  if (deleted.lifecycle !== 'deleted') {
    throw new Error('expected deleted aggregate');
  }

  assert.equal(deleted.planId, active.planId);
  assert.equal(deleted.ownerId, active.ownerId);
  assert.equal(deleted.currentRevision, undefined);
  assert.equal('content' in deleted, false);
  assert.deepEqual(deleted.progress, []);
  assert.deepEqual(deleted.tombstone, {
    planId: active.planId,
    ownerId: active.ownerId,
    deletedAt: '2030-01-03T03:04:05Z',
    terminalRevision: active.currentRevision,
  });

  const replacement = expectFailure(
    replacePlan({
      plan: deleted,
      ownerId: deleted.ownerId,
      expectedRevisionId: active.currentRevision.revisionId,
      candidate: makeCandidate(),
      allocator: new TestAllocator(),
      acceptedAt: asTimestamp('2030-01-04T03:04:05Z'),
    }),
  );
  assert.equal(replacement.category, 'plan_deleted');
});

test('rejects repeated deletion and stale deletion without mutating accepted state', () => {
  const active = createFixture();
  const before = structuredClone(active);

  const stale = expectFailure(
    deletePlan({
      plan: active,
      ownerId: active.ownerId,
      expectedRevisionId: 'stale-revision' as RevisionId,
      deletedAt: asTimestamp('2030-01-03T03:04:05Z'),
    }),
  );
  assert.equal(stale.category, 'deletion_conflict');
  assert.equal(stale.details[0]?.code, 'deletion_conflict');
  assert.deepEqual(active, before);

  const deleted = expectSuccess(
    deletePlan({
      plan: active,
      ownerId: active.ownerId,
      expectedRevisionId: active.currentRevision.revisionId,
      deletedAt: asTimestamp('2030-01-03T03:04:05Z'),
    }),
  );
  if (deleted.lifecycle !== 'deleted') {
    throw new Error('expected deleted aggregate');
  }

  const repeated = expectFailure(
    deletePlan({
      plan: deleted,
      ownerId: deleted.ownerId,
      expectedRevisionId: active.currentRevision.revisionId,
      deletedAt: asTimestamp('2030-01-04T03:04:05Z'),
    }),
  );
  assert.equal(repeated.category, 'plan_deleted');
});

test('maps unauthorized and malformed deletion requests to safe failures', () => {
  const active = createFixture();
  const before = structuredClone(active);

  const unauthorized = expectFailure(
    deletePlan({
      plan: active,
      ownerId: ownerId('owner-other'),
      expectedRevisionId: active.currentRevision.revisionId,
      deletedAt: asTimestamp('2030-01-03T03:04:05Z'),
      deletionOperationId: 'operation-delete-1',
    }),
  );
  assert.equal(unauthorized.category, 'owner_unavailable');
  assert.equal(unauthorized.details.some((detail) => detail.path), false);
  assert.deepEqual(active, before);

  const malformedTime = expectFailure(
    deletePlan({
      plan: active,
      ownerId: active.ownerId,
      expectedRevisionId: active.currentRevision.revisionId,
      deletedAt: asTimestamp('not-a-timestamp'),
    }),
  );
  assert.equal(malformedTime.category, 'malformed_input');
  assert.equal(malformedTime.details[0]?.path, 'deletedAt');
  assert.deepEqual(active, before);
});

test('rejects deletion when embedded progress belongs to another owner or plan', () => {
  const active = createFixture();
  const foreignProgress = {
    ownerId: ownerId('owner-foreign-deletion'),
    planId: expectSuccess(brandIdentifier('plan', 'plan-foreign-deletion')),
    itemId: expectSuccess(brandIdentifier('plan_item', 'item-delete')),
    state: 'in_progress' as const,
    progressVersion: 1,
    lastConfirmedAt: asTimestamp('2030-01-03T03:04:05Z'),
  };
  const malformedPlan = { ...active, progress: [foreignProgress] };
  const before = structuredClone(malformedPlan);

  const failure = expectFailure(
    deletePlan({
      plan: malformedPlan,
      ownerId: malformedPlan.ownerId,
      expectedRevisionId: malformedPlan.currentRevision.revisionId,
      deletedAt: asTimestamp('2030-01-04T03:04:05Z'),
    }),
  );

  assert.equal(failure.category, 'malformed_input');
  assert.deepEqual(malformedPlan, before);
});
