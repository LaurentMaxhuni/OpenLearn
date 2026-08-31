import test from 'node:test';
import assert from 'node:assert/strict';

import {
  accountDeletionFixture,
  acceptedCompleteFixture,
  acceptedNoProgressFixture,
  acceptedPartialFixture,
  deletionConfirmationFixture,
  deletionConflictFixture,
  deletionRecoveringFixture,
  duplicateIdentifiersFixture,
  deletedPlanFixture,
  malformedCandidateFixture,
  opaqueResourceFixture,
  progressCompletedWithUndoFixture,
  progressCompletionPendingFixture,
  progressConflictFixture,
  progressInProgressFixture,
  progressNotStartedFixture,
  progressUndoPendingFixture,
  revisionPreservesProgressFixture,
  staleRevisionConflictFixture,
  unsafeResourceFixture,
  unauthorizedPlanFixture,
} from '../src/index.js';

test('returns deterministic complete, partial, and no-progress fixtures', () => {
  const complete = acceptedCompleteFixture();
  const partial = acceptedPartialFixture();
  const noProgress = acceptedNoProgressFixture();

  assert.equal(complete.lifecycle, 'active');
  assert.equal(complete.content.milestones.length > 0, true);
  assert.equal(complete.progress.some((record) => record.state === 'completed_by_learner'), true);
  assert.equal(partial.content.missingOptionalPaths.length > 0, true);
  assert.equal(noProgress.progress.length, 0);
  assert.equal(
    JSON.stringify(complete),
    JSON.stringify(acceptedCompleteFixture()),
  );
  assert.equal(
    JSON.stringify(partial),
    JSON.stringify(acceptedPartialFixture()),
  );
  assert.equal(
    JSON.stringify(noProgress),
    JSON.stringify(acceptedNoProgressFixture()),
  );
});

test('returns deterministic revision, progress, deletion, and authorization scenarios', () => {
  const revision = revisionPreservesProgressFixture();
  assert.equal(revision.before.lifecycle, 'active');
  assert.equal(revision.after.lifecycle, 'active');
  assert.notEqual(
    revision.before.currentRevision.revisionId,
    revision.after.currentRevision.revisionId,
  );
  assert.equal(
    revision.after.progress.some(
      (record) => record.itemId === revision.stableItemId,
    ),
    true,
  );
  assert.equal(
    revision.after.progress.some(
      (record) => record.itemId === revision.omittedItemId,
    ),
    true,
  );
  assert.notEqual(revision.newItemId, revision.omittedItemId);

  const staleRevision = staleRevisionConflictFixture();
  assert.equal(staleRevision.outcome.ok, false);
  if (staleRevision.outcome.ok) {
    throw new Error('expected stale revision failure');
  }
  assert.equal(staleRevision.outcome.category, 'stale_revision');

  const deletionConflict = deletionConflictFixture();
  assert.equal(deletionConflict.outcome.ok, false);
  if (deletionConflict.outcome.ok) {
    throw new Error('expected deletion conflict');
  }
  assert.equal(deletionConflict.outcome.category, 'deletion_conflict');

  const deleted = deletedPlanFixture();
  assert.equal(deleted.lifecycle, 'deleted');
  assert.equal('content' in deleted, false);
  assert.equal(deleted.tombstone.planId, deleted.planId);

  const unauthorized = unauthorizedPlanFixture();
  assert.equal(unauthorized.ok, false);
  if (unauthorized.ok) {
    throw new Error('expected unavailable fixture');
  }
  assert.equal(unauthorized.category, 'owner_unavailable');
  assert.equal(JSON.stringify(unauthorized).includes('content'), false);
});

test('keeps pending progress operation state separate from confirmed state', () => {
  const pending = progressCompletionPendingFixture();
  assert.equal(pending.operation.status, 'pending');
  assert.equal(pending.operation.action, 'complete_item');
  assert.equal(pending.confirmedProgress.state, 'not_started');
  assert.equal(pending.plan.progress.length, 0);

  const conflict = progressConflictFixture();
  assert.equal(conflict.outcome.ok, false);
  if (conflict.outcome.ok) {
    throw new Error('expected progress conflict');
  }
  assert.equal(conflict.outcome.category, 'stale_progress');
  assert.equal(
    conflict.plan.progress[0]?.state,
    'completed_by_learner',
  );
});

test('exports the complete deterministic domain fixture matrix', () => {
  const factories = [
    acceptedCompleteFixture,
    acceptedPartialFixture,
    acceptedNoProgressFixture,
    revisionPreservesProgressFixture,
    staleRevisionConflictFixture,
    malformedCandidateFixture,
    duplicateIdentifiersFixture,
    unsafeResourceFixture,
    opaqueResourceFixture,
    progressNotStartedFixture,
    progressInProgressFixture,
    progressCompletionPendingFixture,
    progressCompletedWithUndoFixture,
    progressUndoPendingFixture,
    progressConflictFixture,
    deletionConfirmationFixture,
    deletionConflictFixture,
    deletionRecoveringFixture,
    deletedPlanFixture,
    unauthorizedPlanFixture,
    accountDeletionFixture,
  ];

  for (const factory of factories) {
    assert.equal(JSON.stringify(factory()), JSON.stringify(factory()));
  }

  const malformed = malformedCandidateFixture();
  assert.equal(malformed.outcome.category, 'malformed_input');

  const duplicate = duplicateIdentifiersFixture();
  assert.equal(duplicate.outcome.category, 'duplicate_identifier');

  const unsafe = unsafeResourceFixture();
  assert.equal(unsafe.outcome.category, 'unsafe_content');

  const opaque = opaqueResourceFixture();
  assert.equal(opaque.resource.opaqueReference, 'fixture-opaque-reference');

  assert.equal(progressNotStartedFixture().progress.state, 'not_started');
  assert.equal(progressNotStartedFixture().progress.progressVersion, 0);
  assert.equal(progressInProgressFixture().progress.state, 'in_progress');
  assert.equal(
    progressCompletedWithUndoFixture().progress.state,
    'completed_by_learner',
  );
  assert.equal(progressUndoPendingFixture().operation.status, 'pending');
  assert.equal(progressUndoPendingFixture().confirmedProgress.state, 'completed_by_learner');

  assert.equal(deletionConfirmationFixture().operation.status, 'confirmed');
  assert.equal(deletionRecoveringFixture().operation.status, 'recovering');
  assert.equal(accountDeletionFixture().retention.accountPrimaryPurgeAt !== undefined, true);
});
