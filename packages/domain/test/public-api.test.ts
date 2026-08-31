import test from 'node:test';
import assert from 'node:assert/strict';

import {
  acceptedNoProgressFixture,
  applyProgressAction,
  brandIdentifier,
  readOwnedAcceptedSnapshot,
  type DomainResult,
  type InternalOwnerId,
  type Timestamp,
} from '../src/index.js';

const expectSuccess = <T>(result: DomainResult<T>): T => {
  assert.equal(result.ok, true);
  if (!result.ok) {
    throw new Error(`expected success, received ${result.category}`);
  }

  return result.value;
};

const asTimestamp = (value: string): Timestamp => value as Timestamp;

test('the public entry point supports an owner-scoped read and learner completion', () => {
  const plan = acceptedNoProgressFixture();
  const before = expectSuccess(readOwnedAcceptedSnapshot(plan, plan.ownerId));
  const firstItem = before.currentProgress[0];

  assert.equal(firstItem?.state, 'not_started');
  if (firstItem === undefined) {
    throw new Error('expected fixture item');
  }

  const completedPlan = expectSuccess(
    applyProgressAction({
      plan,
      ownerId: plan.ownerId,
      expectedRevisionId: before.revisionId,
      itemId: firstItem.itemId,
      expectedProgressVersion: firstItem.progressVersion,
      action: 'complete_item',
      confirmedAt: asTimestamp('2030-01-03T03:04:05Z'),
    }),
  );
  const after = expectSuccess(
    readOwnedAcceptedSnapshot(completedPlan, completedPlan.ownerId),
  );

  assert.equal(after.progressSummary.completedCount, 1);
  assert.equal(after.currentProgress[0]?.state, 'completed_by_learner');
});

test('requires an explicit identity-boundary conversion for raw actor strings', () => {
  const plan = acceptedNoProgressFixture();
  const rawActorId = 'owner-internal-fixture';

  // @ts-expect-error A raw actor string is not an InternalOwnerId.
  const invalidCall = readOwnedAcceptedSnapshot(plan, rawActorId);
  void invalidCall;

  const converted = brandIdentifier('internal_owner', rawActorId);
  assert.equal(converted.ok, true);
  if (!converted.ok) {
    throw new Error('expected explicit owner conversion to succeed');
  }

  const result = readOwnedAcceptedSnapshot(
    plan,
    converted.value as InternalOwnerId,
  );
  assert.equal(result.ok, true);
});
