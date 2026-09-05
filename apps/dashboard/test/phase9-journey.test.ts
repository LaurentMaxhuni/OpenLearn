import test from 'node:test';
import assert from 'node:assert/strict';
import {
  changePersonalizationConsent,
  evaluatePersonalization,
  recordLearnerFeedback,
  acceptedNoProgressFixture,
  type IdentityAllocator,
  type Timestamp,
} from '@openlearn/domain';
import { applyDashboardProgressAction } from '../src/progress-actions.js';
import { toPlanDetailViewModel } from '../src/view-model.js';

const allocationCounters = new Map<string, number>();
const allocator: IdentityAllocator = {
  allocate(kind) {
    const next = (allocationCounters.get(kind) ?? 0) + 1;
    allocationCounters.set(kind, next);
    return `phase9-${kind}-${next}`;
  },
};

const timestamp = (value: string): Timestamp => value as Timestamp;

test('preserves accepted content while a learner completes a step and reviews a suggestion', () => {
  const plan = acceptedNoProgressFixture();
  const originalContent = JSON.stringify(plan.content);
  const originalProgress = JSON.stringify(plan.progress);
  const progressed = applyDashboardProgressAction({
    plan,
    itemId: 'fixture-item-reading',
    action: 'complete',
    confirmedAt: '2030-01-06T03:04:05Z',
  });

  assert.equal(progressed.ok, true);
  if (!progressed.ok) return;
  assert.equal(JSON.stringify(progressed.plan.content), originalContent);
  assert.equal(JSON.stringify(progressed.plan.progress) === originalProgress, false);

  const enabled = changePersonalizationConsent({
    state: {
      ownerId: plan.ownerId,
      planId: plan.planId,
      stateVersion: 0,
      consent: {
        ownerId: plan.ownerId,
        planId: plan.planId,
        state: 'disabled',
        consentVersion: 0,
        updatedAt: timestamp('2030-01-06T03:04:05Z'),
      },
      feedback: [],
      proposals: [],
    },
    action: 'enable',
    now: timestamp('2030-01-06T03:04:06Z'),
  });
  assert.equal(enabled.ok, true);
  if (!enabled.ok) return;

  const feedback = recordLearnerFeedback({
    plan,
    state: enabled.value,
    ownerId: plan.ownerId,
    area: 'relevance',
    value: 'not_relevant',
    recordedAt: timestamp('2030-01-06T03:04:07Z'),
    allocator,
  });
  assert.equal(feedback.ok, true);
  if (!feedback.ok) return;

  const evaluation = evaluatePersonalization({
    plan,
    state: feedback.value.state,
    ownerId: plan.ownerId,
    now: timestamp('2030-01-06T03:04:08Z'),
    allocator,
  });
  assert.equal(evaluation.ok, true);
  if (!evaluation.ok) return;
  assert.equal(JSON.stringify(evaluation.value.state.feedback).includes('not_relevant'), true);
  assert.equal(JSON.stringify(plan.content), originalContent);
  assert.equal(JSON.stringify(plan.progress), originalProgress);
});

test('keeps recovery and conflict language while exposing the current plan and learner controls', () => {
  const plan = acceptedNoProgressFixture();
  const model = toPlanDetailViewModel(
    {
      planId: plan.planId,
      revisionId: plan.currentRevision.revisionId,
      revisionNumber: plan.currentRevision.revisionNumber,
      acceptedAt: plan.currentRevision.acceptedAt,
      content: plan.content,
      missingOptionalPaths: [],
      currentProgress: [],
      progressSummary: {
        totalCount: 2,
        completedCount: 0,
        inProgressCount: 0,
        notStartedCount: 2,
        remainingCount: 2,
      },
      nextItemId: 'fixture-item-reading',
    },
    {
      href: `/plans/${plan.planId}`,
      contentState: 'conflict',
      personalization: {
        ownerId: plan.ownerId,
        planId: plan.planId,
        stateVersion: 0,
        consent: {
          ownerId: plan.ownerId,
          planId: plan.planId,
          state: 'disabled',
          consentVersion: 0,
          updatedAt: timestamp('2030-01-06T03:04:05Z'),
        },
        feedback: [],
        proposals: [],
      },
    },
  );

  assert.equal(model.surfaceState, 'conflict');
  assert.equal(/current accepted plan remains available/u.test(model.trust.detail), true);
  assert.equal(model.personalization?.state, 'disabled');
  assert.equal(model.personalization?.scopeLabel, 'This plan only');
  assert.equal(model.outline.length > 0, true);
  assert.equal(model.focusedItem?.itemId, 'fixture-item-reading');
});
