import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptedCompleteFixture,
  acceptedNoProgressFixture,
} from '@openlearn/domain';
import { applyDashboardProgressAction } from '../src/progress-actions.js';

const noProgressPlan = () => acceptedNoProgressFixture();
const completedPlan = () => acceptedCompleteFixture();

test('maps start, complete, and undo intents to domain transitions', () => {
  const base = noProgressPlan();
  const itemId = 'fixture-item-reading';
  const started = applyDashboardProgressAction({
    plan: base,
    itemId,
    action: 'start',
    confirmedAt: '2030-01-06T03:04:07Z',
  });
  assert.equal(started.ok, true);
  if (!started.ok) throw new Error('expected start to succeed');
  assert.equal(started.plan.progress[0]?.state, 'in_progress');

  const completed = applyDashboardProgressAction({
    plan: started.plan,
    itemId,
    action: 'complete',
    confirmedAt: '2030-01-06T03:04:08Z',
  });
  assert.equal(completed.ok, true);
  if (!completed.ok) throw new Error('expected complete to succeed');
  assert.equal(completed.plan.progress[0]?.state, 'completed_by_learner');

  const undone = applyDashboardProgressAction({
    plan: completed.plan,
    itemId,
    action: 'undo_completion',
    confirmedAt: '2030-01-06T03:04:09Z',
  });
  assert.equal(undone.ok, true);
  if (!undone.ok) throw new Error('expected undo to succeed');
  assert.equal(undone.plan.progress[0]?.state, 'in_progress');
});

test('maps stale progress to a conflict without changing the supplied plan', () => {
  const plan = completedPlan();
  const result = applyDashboardProgressAction({
    plan,
    itemId: 'fixture-item-reading',
    action: 'undo_completion',
    expectedProgressVersion: 0,
    confirmedAt: '2030-01-06T03:04:09Z',
  });

  assert.deepEqual(result, {
    ok: false,
    kind: 'conflict',
    message: 'Progress changed. Read the current item before retrying.',
  });
  assert.deepEqual(plan, completedPlan());
});

test('maps an unknown item to an unavailable action', () => {
  const result = applyDashboardProgressAction({
    plan: noProgressPlan(),
    itemId: 'fixture-item-missing',
    action: 'start',
    confirmedAt: '2030-01-06T03:04:09Z',
  });

  assert.deepEqual(result, {
    ok: false,
    kind: 'unavailable',
    message: 'This learning item is not available in the current plan.',
  });
});

test('maps a stale revision to a conflict without changing the supplied plan', () => {
  const plan = noProgressPlan();
  const result = applyDashboardProgressAction({
    plan,
    itemId: 'fixture-item-reading',
    action: 'start',
    expectedRevisionId: 'fixture-revision-stale',
    confirmedAt: '2030-01-06T03:04:09Z',
  });

  assert.deepEqual(result, {
    ok: false,
    kind: 'conflict',
    message: 'The plan changed. Read the current plan before retrying.',
  });
  assert.deepEqual(plan, noProgressPlan());
});
