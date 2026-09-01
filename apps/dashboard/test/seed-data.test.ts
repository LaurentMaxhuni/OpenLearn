import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptedCompleteFixture } from '@openlearn/domain';
import { snapshotOfPlan } from '../src/seed-data.js';

test('snapshotOfPlan reflects progress from the supplied aggregate', () => {
  const snapshot = snapshotOfPlan(acceptedCompleteFixture());
  assert.equal(snapshot.progressSummary.completedCount, 1);
  assert.equal(
    snapshot.currentProgress.find(
      (record: { readonly itemId: string; readonly state: string }) =>
        record.itemId === 'fixture-item-reading',
    )?.state,
    'completed_by_learner',
  );
  assert.equal(snapshot.nextItemId, 'fixture-item-request-flow');
});
