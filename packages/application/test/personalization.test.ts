import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptedNoProgressFixture,
  brandIdentifier,
  createPersonalizationState,
  type IdentityAllocator,
  type PersonalizationState,
} from '@openlearn/domain';
import {
  createPersonalizationApplication,
  type ActorContext,
  type PersonalizationStatePort,
} from '../src/index.js';

const plan = acceptedNoProgressFixture();
const NOW = new Date('2030-01-06T03:04:05.000Z');
const actor: ActorContext = {
  ownerId: plan.ownerId,
  scopes: ['personalization:read', 'personalization:write'],
  actorClass: 'local_stdio',
};
const readOnlyActor: ActorContext = {
  ...actor,
  scopes: ['personalization:read'],
};

class TestAllocator implements IdentityAllocator {
  private readonly counters = new Map<string, number>();

  allocate(kind: Parameters<IdentityAllocator['allocate']>[0]): string {
    const next = (this.counters.get(kind) ?? 0) + 1;
    this.counters.set(kind, next);
    return `application-${kind}-${next}`;
  }
}

const createHarness = () => {
  const states = new Map<string, PersonalizationState>();
  const plans = new Map([[plan.planId, plan]]);
  const personalization: PersonalizationStatePort = {
    async readPersonalization(ownerId, planId) {
      const state = states.get(`${ownerId}:${planId}`);
      return state;
    },
    async writePersonalization(next, expectedStateVersion) {
      const key = `${next.ownerId}:${next.planId}`;
      const current = states.get(key);
      if ((current?.stateVersion ?? 0) !== expectedStateVersion) {
        return { ok: false, kind: 'conflict' };
      }
      states.set(key, next);
      return { ok: true };
    },
    async purgePersonalization(ownerId, planId, expectedStateVersion) {
      const key = `${ownerId}:${planId}`;
      const current = states.get(key);
      if (
        expectedStateVersion !== undefined &&
        (current?.stateVersion ?? 0) !== expectedStateVersion
      ) {
        return { ok: false, kind: 'conflict' };
      }
      states.delete(key);
      return { ok: true };
    },
  };
  const application = createPersonalizationApplication({
    planReader: {
      readPlan: async (planId) => plans.get(planId),
    },
    state: personalization,
    allocator: new TestAllocator(),
    clock: { now: () => NOW },
    operationIds: (() => {
      let next = 0;
      return { next: () => `personalization-operation-${++next}` };
    })(),
  });
  return { application, states, personalization };
};

test('returns a disabled default and enforces personalization capabilities', async () => {
  const { application } = createHarness();
  const initial = await application.getPersonalization(actor, {
    planId: plan.planId,
  });
  assert.equal(initial.outcome, 'succeeded');
  assert.equal(initial.value?.consent.state, 'disabled');

  const missingWrite = await application.changePersonalizationConsent(readOnlyActor, {
    planId: plan.planId,
    action: 'enable',
    expectedStateVersion: 0,
  });
  assert.equal(missingWrite.outcome, 'rejected');
  assert.equal(missingWrite.error?.code, 'missing_capability');
});

test('coordinates consent, feedback, evaluation, and proposal decisions without plan writes', async () => {
  const { application, states } = createHarness();
  const enabled = await application.changePersonalizationConsent(actor, {
    planId: plan.planId,
    action: 'enable',
    expectedStateVersion: 0,
  });
  assert.equal(enabled.outcome, 'succeeded');
  assert.equal(enabled.value?.stateVersion, 1);

  const feedback = await application.recordLearnerFeedback(actor, {
    planId: plan.planId,
    area: 'relevance',
    value: 'not_relevant',
    expectedStateVersion: 1,
  });
  assert.equal(feedback.outcome, 'succeeded');
  assert.equal(feedback.value?.status, 'active');

  const evaluated = await application.evaluatePersonalization(actor, {
    planId: plan.planId,
    expectedStateVersion: 2,
  });
  assert.equal(evaluated.outcome, 'succeeded');
  const proposal = evaluated.value?.createdProposal;
  assert.equal(proposal?.parameters.kind, 'request_plan_revision');
  assert.equal(states.get(`${plan.ownerId}:${plan.planId}`)?.stateVersion, 3);

  if (proposal === undefined) {
    throw new Error('expected proposal');
  }
  const stale = await application.decidePersonalizationProposal(actor, {
    planId: plan.planId,
    proposalId: proposal.proposalId,
    decision: 'accept',
    expectedProposalVersion: proposal.proposalVersion,
    expectedStateVersion: 2,
  });
  assert.equal(stale.outcome, 'conflict');
  assert.equal(stale.error?.code, 'stale_personalization');

  const accepted = await application.decidePersonalizationProposal(actor, {
    planId: plan.planId,
    proposalId: proposal.proposalId,
    decision: 'accept',
    expectedProposalVersion: proposal.proposalVersion,
    expectedStateVersion: 3,
  });
  assert.equal(accepted.outcome, 'succeeded');
  assert.equal(accepted.value?.handoff?.intent.kind, 'plan_revision');
  assert.equal(plan.lifecycle, 'active');
  assert.equal(plan.progress.length, 0);
});

test('maps compare-and-set and owner/plan failures to safe application outcomes', async () => {
  const { application, states, personalization } = createHarness();
  const conflict = await application.changePersonalizationConsent(actor, {
    planId: plan.planId,
    action: 'enable',
    expectedStateVersion: 12,
  });
  assert.equal(conflict.outcome, 'conflict');
  assert.equal(conflict.error?.code, 'stale_personalization');

  const otherOwner = brandIdentifier('internal_owner', 'other-application-owner');
  if (!otherOwner.ok) {
    throw new Error('invalid test owner');
  }
  const unauthorized: ActorContext = {
    ...actor,
    ownerId: otherOwner.value,
  };
  const unavailable = await application.getPersonalization(unauthorized, {
    planId: plan.planId,
  });
  assert.equal(unavailable.outcome, 'rejected');
  assert.equal(unavailable.error?.code, 'unavailable');

  const readResult = await personalization.readPersonalization(plan.ownerId, plan.planId);
  assert.equal(readResult, undefined);

  const foreignState = createPersonalizationState({
    ownerId: otherOwner.value,
    planId: plan.planId,
    now: '2030-01-06T03:04:05Z',
  });
  assert.equal(foreignState.ok, true);
  if (!foreignState.ok) {
    throw new Error('expected a valid foreign test state');
  }
  states.set(`${plan.ownerId}:${plan.planId}`, foreignState.value);
  const hidden = await application.getPersonalization(actor, {
    planId: plan.planId,
  });
  assert.equal(hidden.outcome, 'rejected');
  assert.equal(hidden.error?.code, 'unavailable');
});

test('purges plan-scoped personalization with an optional compare-and-set fence', async () => {
  const { application, states } = createHarness();
  const enabled = await application.changePersonalizationConsent(actor, {
    planId: plan.planId,
    action: 'enable',
    expectedStateVersion: 0,
  });
  assert.equal(enabled.outcome, 'succeeded');

  const stale = await application.purgePersonalization(actor, {
    planId: plan.planId,
    expectedStateVersion: 0,
  });
  assert.equal(stale.outcome, 'conflict');
  assert.equal(stale.error?.code, 'stale_personalization');

  const purged = await application.purgePersonalization(actor, {
    planId: plan.planId,
    expectedStateVersion: 1,
  });
  assert.equal(purged.outcome, 'succeeded');
  assert.equal(states.get(`${plan.ownerId}:${plan.planId}`), undefined);
});
