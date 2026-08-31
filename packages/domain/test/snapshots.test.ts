import test from 'node:test';
import assert from 'node:assert/strict';

import {
  acceptedCompleteFixture,
  acceptedPartialFixture,
  deletedPlanFixture,
  readOwnedAcceptedSnapshot,
  type DomainResult,
  type InternalOwnerId,
} from '../src/index.js';

const expectSuccess = <T>(result: DomainResult<T>): T => {
  assert.equal(result.ok, true);
  if (!result.ok) {
    throw new Error(`expected success, received ${result.category}`);
  }

  return result.value;
};

test('maps an authorized active plan to a deterministic dashboard snapshot', () => {
  const plan = acceptedCompleteFixture();
  const snapshot = expectSuccess(readOwnedAcceptedSnapshot(plan, plan.ownerId));

  assert.equal(snapshot.planId, plan.planId);
  assert.equal(snapshot.revisionId, plan.currentRevision.revisionId);
  assert.equal(snapshot.revisionNumber, plan.currentRevision.revisionNumber);
  assert.equal(snapshot.acceptedAt, plan.currentRevision.acceptedAt);
  assert.equal('missingOptionalPaths' in snapshot.content, false);
  assert.equal(snapshot.progressSummary.totalCount, 2);
  assert.equal(snapshot.progressSummary.completedCount, 1);
  assert.equal(snapshot.progressSummary.remainingCount, 1);
  assert.equal(snapshot.nextItemId, 'fixture-item-request-flow');
  assert.deepEqual(
    snapshot.currentProgress.map((record) => record.state),
    ['completed_by_learner', 'in_progress'],
  );
});

test('materializes absent progress as not_started and preserves partial diagnostics', () => {
  const plan = acceptedPartialFixture();
  const snapshot = expectSuccess(readOwnedAcceptedSnapshot(plan, plan.ownerId));

  assert.equal(snapshot.progressSummary.totalCount, 1);
  assert.equal(snapshot.progressSummary.completedCount, 0);
  assert.equal(snapshot.progressSummary.remainingCount, 1);
  assert.equal(snapshot.nextItemId, 'fixture-item-partial');
  assert.equal(snapshot.currentProgress[0]?.state, 'not_started');
  assert.equal(snapshot.currentProgress[0]?.progressVersion, 0);
  assert.equal(snapshot.missingOptionalPaths.length > 0, true);
});

test('returns non-disclosing failures for the wrong owner and deleted plans', () => {
  const plan = acceptedCompleteFixture();
  const wrongOwner = 'owner-not-authorized' as InternalOwnerId;

  const unauthorized = readOwnedAcceptedSnapshot(plan, wrongOwner);
  assert.equal(unauthorized.ok, false);
  if (unauthorized.ok) {
    throw new Error('expected unauthorized snapshot failure');
  }
  assert.equal(unauthorized.category, 'owner_unavailable');
  assert.equal(unauthorized.details.some((detail) => detail.path), false);

  const deleted = deletedPlanFixture();
  const deletedResult = readOwnedAcceptedSnapshot(deleted, deleted.ownerId);
  assert.equal(deletedResult.ok, false);
  if (deletedResult.ok) {
    throw new Error('expected deleted snapshot failure');
  }
  assert.equal(deletedResult.category, 'plan_deleted');
  assert.equal(JSON.stringify(deletedResult).includes('content'), false);
});
