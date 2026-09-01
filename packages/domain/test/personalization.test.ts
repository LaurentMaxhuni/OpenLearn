import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptedNoProgressFixture,
  brandIdentifier,
  changePersonalizationConsent,
  correctLearnerFeedback,
  decidePersonalizationProposal,
  deleteLearnerFeedback,
  evaluatePersonalization,
  progressInProgressFixture,
  recordLearnerFeedback,
  createPersonalizationState,
  type ActivePlanAggregate,
  type DomainResult,
  type IdentityAllocator,
  type InternalOwnerId,
  type PersonalizationState,
  type Timestamp,
} from '../src/index.js';

const NOW = '2030-01-06T03:04:05Z' as Timestamp;
const LATER = '2030-01-06T03:05:05Z' as Timestamp;
const NEWER = '2030-01-06T03:06:05Z' as Timestamp;

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

const fixture = acceptedNoProgressFixture();

const owner = (value: string): InternalOwnerId => {
  const result = brandIdentifier('internal_owner', value);
  if (!result.ok) {
    throw new Error('invalid test owner');
  }
  return result.value;
};

class TestAllocator implements IdentityAllocator {
  private readonly counters = new Map<string, number>();

  allocate(kind: Parameters<IdentityAllocator['allocate']>[0]): string {
    const next = (this.counters.get(kind) ?? 0) + 1;
    this.counters.set(kind, next);
    return `personalization-${kind}-${next}`;
  }
}

const stateAt = (plan: ActivePlanAggregate = fixture): PersonalizationState =>
  expectSuccess(
    createPersonalizationState({
      ownerId: plan.ownerId,
      planId: plan.planId,
      now: NOW,
    }),
  );

test('starts disabled and keeps consent transitions scoped and monotonic', () => {
  const initial = stateAt();
  assert.equal(initial.consent.state, 'disabled');
  assert.equal(initial.consent.consentVersion, 0);
  assert.equal(initial.stateVersion, 0);

  const enabled = expectSuccess(
    changePersonalizationConsent({
      state: initial,
      action: 'enable',
      now: LATER,
    }),
  );
  assert.equal(enabled.consent.state, 'enabled');
  assert.equal(enabled.consent.consentVersion, 1);
  assert.equal(enabled.consent.enabledAt, LATER);

  const paused = expectSuccess(
    changePersonalizationConsent({
      state: enabled,
      action: 'pause',
      now: NOW,
    }),
  );
  assert.equal(paused.consent.state, 'paused');
  assert.equal(paused.consent.consentVersion, 1);

  const resumed = expectSuccess(
    changePersonalizationConsent({
      state: paused,
      action: 'resume',
      now: LATER,
    }),
  );
  assert.equal(resumed.consent.state, 'enabled');
  assert.equal(resumed.consent.consentVersion, 1);

  const revoked = expectSuccess(
    changePersonalizationConsent({
      state: resumed,
      action: 'revoke',
      now: NOW,
    }),
  );
  assert.equal(revoked.consent.state, 'revoked');
  assert.equal(revoked.consent.consentVersion, 1);

  const reenabled = expectSuccess(
    changePersonalizationConsent({
      state: revoked,
      action: 'enable',
      now: LATER,
    }),
  );
  assert.equal(reenabled.consent.state, 'enabled');
  assert.equal(reenabled.consent.consentVersion, 2);
  assert.equal(reenabled.consent.enabledAt, LATER);
  assert.equal(reenabled.ownerId, fixture.ownerId);
  assert.equal(reenabled.planId, fixture.planId);
});

test('rejects consent transitions that would bypass explicit learner control', () => {
  const initial = stateAt();
  const disabledPause = expectFailure(
    changePersonalizationConsent({
      state: initial,
      action: 'pause',
      now: LATER,
    }),
  );
  assert.equal(disabledPause.category, 'invalid_transition');

  const enabled = expectSuccess(
    changePersonalizationConsent({
      state: initial,
      action: 'enable',
      now: LATER,
    }),
  );
  const repeatedEnable = expectFailure(
    changePersonalizationConsent({
      state: enabled,
      action: 'enable',
      now: NOW,
    }),
  );
  assert.equal(repeatedEnable.category, 'invalid_transition');

  const invalidOwner = expectFailure(
    createPersonalizationState({
      ownerId: '' as InternalOwnerId,
      planId: fixture.planId,
      now: NOW,
    }),
  );
  assert.equal(invalidOwner.category, 'owner_unavailable');
});

test('consent transitions are independent from accepted plan content and progress', () => {
  const before = structuredClone(fixture);
  const state = stateAt(fixture);
  const enabled = expectSuccess(
    changePersonalizationConsent({
      state,
      action: 'enable',
      now: LATER,
    }),
  );

  assert.deepEqual(fixture, before);
  assert.equal(enabled.planId, fixture.planId);
  assert.deepEqual(enabled.feedback, []);
  assert.deepEqual(enabled.proposals, []);
});

test('captures only bounded current-plan feedback and supports linked correction and deletion', () => {
  const plan = fixture;
  const state = expectSuccess(
    changePersonalizationConsent({
      state: stateAt(plan),
      action: 'enable',
      now: NOW,
    }),
  );
  const allocator = new TestAllocator();
  const recorded = expectSuccess(
    recordLearnerFeedback({
      plan,
      state,
      ownerId: plan.ownerId,
      itemId: 'fixture-item-reading',
      area: 'difficulty',
      value: 'too_hard',
      recordedAt: LATER,
      allocator,
    }),
  );
  assert.equal(recorded.feedback.status, 'active');
  assert.equal(recorded.feedback.consentVersion, 1);
  assert.equal(recorded.feedback.itemId, 'fixture-item-reading');

  const corrected = expectSuccess(
    correctLearnerFeedback({
      plan,
      state: recorded.state,
      ownerId: plan.ownerId,
      feedbackId: recorded.feedback.feedbackId,
      area: 'difficulty',
      value: 'about_right',
      recordedAt: LATER,
      allocator,
    }),
  );
  assert.equal(corrected.feedback.status, 'active');
  assert.equal(corrected.feedback.supersedesFeedbackId, recorded.feedback.feedbackId);
  assert.equal(
    corrected.state.feedback.find(
      (entry) => entry.feedbackId === recorded.feedback.feedbackId,
    )?.status,
    'corrected',
  );

  const deleted = expectSuccess(
    deleteLearnerFeedback({
      plan,
      state: corrected.state,
      ownerId: plan.ownerId,
      feedbackId: corrected.feedback.feedbackId,
    }),
  );
  assert.equal(
    deleted.feedback.some((entry) => entry.feedbackId === corrected.feedback.feedbackId),
    false,
  );

  const withNote = expectFailure(
    recordLearnerFeedback({
      plan,
      state,
      ownerId: plan.ownerId,
      area: 'pace',
      value: 'about_right',
      recordedAt: LATER,
      allocator,
      note: 'unbounded private text',
    } as never),
  );
  assert.equal(withNote.category, 'unknown_field');

  const wrongItem = expectFailure(
    recordLearnerFeedback({
      plan,
      state,
      ownerId: plan.ownerId,
      itemId: 'item-not-in-this-plan',
      area: 'pace',
      value: 'about_right',
      recordedAt: LATER,
      allocator,
    }),
  );
  assert.equal(wrongItem.category, 'invalid_relationship');
});

test('pause and revoke stop future feedback use without touching learner progress', () => {
  const plan = fixture;
  const enabled = expectSuccess(
    changePersonalizationConsent({
      state: stateAt(plan),
      action: 'enable',
      now: NOW,
    }),
  );
  const paused = expectSuccess(
    changePersonalizationConsent({
      state: enabled,
      action: 'pause',
      now: LATER,
    }),
  );
  const pausedCapture = expectFailure(
    recordLearnerFeedback({
      plan,
      state: paused,
      ownerId: plan.ownerId,
      area: 'relevance',
      value: 'relevant',
      recordedAt: LATER,
      allocator: new TestAllocator(),
    }),
  );
  assert.equal(pausedCapture.category, 'invalid_transition');

  const beforePlan = structuredClone(plan);
  const revoked = expectSuccess(
    changePersonalizationConsent({
      state: paused,
      action: 'revoke',
      now: LATER,
    }),
  );
  assert.equal(revoked.feedback.length, 0);
  assert.deepEqual(plan, beforePlan);
});

test('correction and deletion withdraw proposals based on superseded feedback', () => {
  const plan = fixture;
  const allocator = new TestAllocator();
  const enabled = expectSuccess(
    changePersonalizationConsent({
      state: stateAt(plan),
      action: 'enable',
      now: NOW,
    }),
  );
  const recorded = expectSuccess(
    recordLearnerFeedback({
      plan,
      state: enabled,
      ownerId: plan.ownerId,
      area: 'relevance',
      value: 'not_relevant',
      recordedAt: NOW,
      allocator,
    }),
  );
  const firstEvaluation = expectSuccess(
    evaluatePersonalization({
      plan,
      state: recorded.state,
      ownerId: plan.ownerId,
      now: NOW,
      allocator,
    }),
  );
  const firstProposal = firstEvaluation.createdProposal;
  if (firstProposal === undefined) {
    throw new Error('expected a proposal from the original feedback');
  }
  const corrected = expectSuccess(
    correctLearnerFeedback({
      plan,
      state: firstEvaluation.state,
      ownerId: plan.ownerId,
      feedbackId: recorded.feedback.feedbackId,
      area: 'relevance',
      value: 'relevant',
      recordedAt: LATER,
      allocator,
    }),
  );
  assert.equal(
    corrected.state.proposals.find((entry) => entry.proposalId === firstProposal.proposalId)?.status,
    'withdrawn',
  );

  const newFeedback = expectSuccess(
    recordLearnerFeedback({
      plan,
      state: corrected.state,
      ownerId: plan.ownerId,
      area: 'relevance',
      value: 'not_relevant',
      recordedAt: LATER,
      allocator,
    }),
  );
  const secondEvaluation = expectSuccess(
    evaluatePersonalization({
      plan,
      state: newFeedback.state,
      ownerId: plan.ownerId,
      now: LATER,
      allocator,
    }),
  );
  const secondProposal = secondEvaluation.createdProposal;
  if (secondProposal === undefined) {
    throw new Error('expected a proposal from the replacement feedback');
  }
  const deleted = expectSuccess(
    deleteLearnerFeedback({
      plan,
      state: secondEvaluation.state,
      ownerId: plan.ownerId,
      feedbackId: newFeedback.feedback.feedbackId,
      now: LATER,
    }),
  );
  assert.equal(
    deleted.proposals.find((entry) => entry.proposalId === secondProposal.proposalId)?.status,
    'withdrawn',
  );
});

test('revoke withdraws unresolved proposals and starts a fresh consent epoch', () => {
  const plan = fixture;
  const enabled = expectSuccess(
    changePersonalizationConsent({
      state: stateAt(plan),
      action: 'enable',
      now: NOW,
    }),
  );
  const feedback = expectSuccess(
    recordLearnerFeedback({
      plan,
      state: enabled,
      ownerId: plan.ownerId,
      area: 'relevance',
      value: 'not_relevant',
      recordedAt: LATER,
      allocator: new TestAllocator(),
    }),
  );
  const evaluated = expectSuccess(
    evaluatePersonalization({
      plan,
      state: feedback.state,
      ownerId: plan.ownerId,
      now: LATER,
      allocator: new TestAllocator(),
    }),
  );
  const proposal = evaluated.createdProposal;
  if (proposal === undefined) {
    throw new Error('expected a proposal before revoke');
  }

  const revoked = expectSuccess(
    changePersonalizationConsent({
      state: evaluated.state,
      action: 'revoke',
      now: LATER,
    }),
  );
  assert.deepEqual(revoked.feedback, []);
  assert.equal(
    revoked.proposals.find((entry) => entry.proposalId === proposal.proposalId)?.status,
    'withdrawn',
  );

  const reenabled = expectSuccess(
    changePersonalizationConsent({
      state: revoked,
      action: 'enable',
      now: LATER,
    }),
  );
  assert.equal(reenabled.consent.consentVersion, 2);
  const afterReenable = expectSuccess(
    evaluatePersonalization({
      plan,
      state: reenabled,
      ownerId: plan.ownerId,
      now: LATER,
      allocator: new TestAllocator(),
    }),
  );
  assert.equal(afterReenable.createdProposal, undefined);
  assert.equal(
    afterReenable.proposals.find((entry) => entry.proposalId === proposal.proposalId)?.status,
    'withdrawn',
  );
});

test('evaluates deterministic current-plan proposals with safe explanations', () => {
  const plan = progressInProgressFixture().plan;
  const enabled = expectSuccess(
    changePersonalizationConsent({
      state: stateAt(plan),
      action: 'enable',
      now: NOW,
    }),
  );
  const feedback = expectSuccess(
    recordLearnerFeedback({
      plan,
      state: enabled,
      ownerId: plan.ownerId,
      area: 'pace',
      value: 'too_fast',
      recordedAt: LATER,
      allocator: new TestAllocator(),
    }),
  );
  const beforePlan = structuredClone(plan);
  const evaluated = expectSuccess(
    evaluatePersonalization({
      plan,
      state: feedback.state,
      ownerId: plan.ownerId,
      now: LATER,
      allocator: new TestAllocator(),
    }),
  );
  const proposal = evaluated.createdProposal;
  assert.equal(proposal?.parameters.kind, 'suggest_pacing_preference');
  assert.deepEqual(proposal?.basis, ['pace_feedback']);
  assert.equal(proposal?.explanation.includes('too_fast'), false);
  assert.equal(proposal?.explanation.includes('pace'), true);
  assert.equal(proposal?.explanation.includes('automatically'), true);
  assert.deepEqual(plan, beforePlan);

  const relevancePlan = fixture;
  const relevanceState = expectSuccess(
    changePersonalizationConsent({
      state: stateAt(relevancePlan),
      action: 'enable',
      now: NOW,
    }),
  );
  const relevanceFeedback = expectSuccess(
    recordLearnerFeedback({
      plan: relevancePlan,
      state: relevanceState,
      ownerId: relevancePlan.ownerId,
      area: 'relevance',
      value: 'not_relevant',
      recordedAt: LATER,
      allocator: new TestAllocator(),
    }),
  );
  const revisionProposal = expectSuccess(
    evaluatePersonalization({
      plan: relevancePlan,
      state: relevanceFeedback.state,
      ownerId: relevancePlan.ownerId,
      now: LATER,
      allocator: new TestAllocator(),
    }),
  ).createdProposal;
  assert.equal(revisionProposal?.parameters.kind, 'request_plan_revision');
  if (revisionProposal?.parameters.kind !== 'request_plan_revision') {
    throw new Error('expected a revision proposal');
  }
  assert.equal(revisionProposal.parameters.reason, 'relevance');
});

test('recommends an existing next step only from confirmed progress and avoids duplicates', () => {
  const plan = progressInProgressFixture().plan;
  const enabled = expectSuccess(
    changePersonalizationConsent({
      state: stateAt(plan),
      action: 'enable',
      now: NOW,
    }),
  );
  const first = expectSuccess(
    evaluatePersonalization({
      plan,
      state: enabled,
      ownerId: plan.ownerId,
      now: NOW,
      allocator: new TestAllocator(),
    }),
  );
  assert.equal(first.createdProposal?.parameters.kind, 'recommend_existing_next_step');
  const second = expectSuccess(
    evaluatePersonalization({
      plan,
      state: first.state,
      ownerId: plan.ownerId,
      now: LATER,
      allocator: new TestAllocator(),
    }),
  );
  assert.equal(second.createdProposal, undefined);
  assert.equal(second.proposals.length, 1);
});

test('withdraws proposed items from an old revision before evaluating the current plan', () => {
  const plan = progressInProgressFixture().plan;
  const allocator = new TestAllocator();
  const enabled = expectSuccess(
    changePersonalizationConsent({
      state: stateAt(plan),
      action: 'enable',
      now: NOW,
    }),
  );
  const evaluated = expectSuccess(
    evaluatePersonalization({
      plan,
      state: enabled,
      ownerId: plan.ownerId,
      now: NOW,
      allocator,
    }),
  );
  const oldProposal = evaluated.createdProposal;
  if (oldProposal === undefined) {
    throw new Error('expected a proposal for the old revision');
  }
  const revision = brandIdentifier('revision', 'revision-rebased');
  if (!revision.ok) {
    throw new Error('invalid test revision');
  }
  const currentPlan: ActivePlanAggregate = {
    ...plan,
    currentRevision: {
      ...plan.currentRevision,
      revisionId: revision.value,
      revisionNumber: plan.currentRevision.revisionNumber + 1,
    },
  };
  const current = expectSuccess(
    evaluatePersonalization({
      plan: currentPlan,
      state: evaluated.state,
      ownerId: currentPlan.ownerId,
      now: LATER,
      allocator,
    }),
  );
  assert.equal(
    current.proposals.find((proposal) => proposal.proposalId === oldProposal.proposalId)?.status,
    'withdrawn',
  );
  assert.notEqual(current.createdProposal?.proposalId, oldProposal.proposalId);
});

test('accepts or rejects only current proposals and returns an opaque handoff without changing the plan', () => {
  const plan = fixture;
  const enabled = expectSuccess(
    changePersonalizationConsent({
      state: stateAt(plan),
      action: 'enable',
      now: NOW,
    }),
  );
  const feedback = expectSuccess(
    recordLearnerFeedback({
      plan,
      state: enabled,
      ownerId: plan.ownerId,
      area: 'relevance',
      value: 'not_relevant',
      recordedAt: LATER,
      allocator: new TestAllocator(),
    }),
  );
  const evaluated = expectSuccess(
    evaluatePersonalization({
      plan,
      state: feedback.state,
      ownerId: plan.ownerId,
      now: LATER,
      allocator: new TestAllocator(),
    }),
  );
  if (evaluated.createdProposal === undefined) {
    throw new Error('expected revision proposal');
  }
  const proposal = evaluated.createdProposal;
  const beforePlan = structuredClone(plan);
  const stale = expectFailure(
    decidePersonalizationProposal({
      plan,
      state: evaluated.state,
      ownerId: plan.ownerId,
      proposalId: proposal.proposalId,
      decision: 'accept',
      expectedProposalVersion: 99,
      now: LATER,
    }),
  );
  assert.equal(stale.category, 'stale_personalization');

  const accepted = expectSuccess(
    decidePersonalizationProposal({
      plan,
      state: evaluated.state,
      ownerId: plan.ownerId,
      proposalId: proposal.proposalId,
      decision: 'accept',
      expectedProposalVersion: proposal.proposalVersion,
      now: LATER,
    }),
  );
  assert.equal(accepted.proposal.status, 'accepted');
  assert.equal(accepted.handoff?.intent.kind, 'plan_revision');
  assert.equal(accepted.handoff?.requestId, proposal.proposalId);
  assert.deepEqual(plan, beforePlan);

  const repeated = expectFailure(
    decidePersonalizationProposal({
      plan,
      state: accepted.state,
      ownerId: plan.ownerId,
      proposalId: proposal.proposalId,
      decision: 'reject',
      expectedProposalVersion: accepted.proposal.proposalVersion,
      now: LATER,
    }),
  );
  assert.equal(repeated.category, 'invalid_transition');
});

test('does not recreate a rejected suggestion until newer evidence arrives', () => {
  const plan = fixture;
  const allocator = new TestAllocator();
  const enabled = expectSuccess(
    changePersonalizationConsent({
      state: stateAt(plan),
      action: 'enable',
      now: NOW,
    }),
  );
  const feedback = expectSuccess(
    recordLearnerFeedback({
      plan,
      state: enabled,
      ownerId: plan.ownerId,
      area: 'relevance',
      value: 'not_relevant',
      recordedAt: NOW,
      allocator,
    }),
  );
  const evaluated = expectSuccess(
    evaluatePersonalization({
      plan,
      state: feedback.state,
      ownerId: plan.ownerId,
      now: NOW,
      allocator,
    }),
  );
  const proposal = evaluated.createdProposal;
  if (proposal === undefined) {
    throw new Error('expected a proposal to reject');
  }
  const rejected = expectSuccess(
    decidePersonalizationProposal({
      plan,
      state: evaluated.state,
      ownerId: plan.ownerId,
      proposalId: proposal.proposalId,
      decision: 'reject',
      expectedProposalVersion: proposal.proposalVersion,
      now: LATER,
    }),
  );
  const unchanged = expectSuccess(
    evaluatePersonalization({
      plan,
      state: rejected.state,
      ownerId: plan.ownerId,
      now: LATER,
      allocator,
    }),
  );
  assert.equal(unchanged.createdProposal, undefined);

  const newerFeedback = expectSuccess(
    recordLearnerFeedback({
      plan,
      state: rejected.state,
      ownerId: plan.ownerId,
      area: 'relevance',
      value: 'not_relevant',
      recordedAt: NEWER,
      allocator,
    }),
  );
  const refreshed = expectSuccess(
    evaluatePersonalization({
      plan,
      state: newerFeedback.state,
      ownerId: plan.ownerId,
      now: NEWER,
      allocator,
    }),
  );
  assert.notEqual(refreshed.createdProposal?.proposalId, proposal.proposalId);
});

test('expires proposals before they can be accepted and never revives them', () => {
  const plan = fixture;
  const allocator = new TestAllocator();
  const enabled = expectSuccess(
    changePersonalizationConsent({
      state: stateAt(plan),
      action: 'enable',
      now: NOW,
    }),
  );
  const feedback = expectSuccess(
    recordLearnerFeedback({
      plan,
      state: enabled,
      ownerId: plan.ownerId,
      area: 'relevance',
      value: 'not_relevant',
      recordedAt: NOW,
      allocator,
    }),
  );
  const evaluated = expectSuccess(
    evaluatePersonalization({
      plan,
      state: feedback.state,
      ownerId: plan.ownerId,
      now: NOW,
      allocator,
    }),
  );
  const proposal = evaluated.createdProposal;
  if (proposal === undefined) {
    throw new Error('expected expiring proposal');
  }
  const expired = expectSuccess(
    evaluatePersonalization({
      plan,
      state: evaluated.state,
      ownerId: plan.ownerId,
      now: '2031-01-01T00:00:00Z',
      allocator,
    }),
  );
  assert.equal(expired.state.proposals[0]?.status, 'expired');
  const revived = expectFailure(
    decidePersonalizationProposal({
      plan,
      state: expired.state,
      ownerId: plan.ownerId,
      proposalId: proposal.proposalId,
      decision: 'accept',
      expectedProposalVersion: 2,
      now: '2031-01-01T00:00:00Z',
    }),
  );
  assert.equal(revived.category, 'invalid_transition');
});
