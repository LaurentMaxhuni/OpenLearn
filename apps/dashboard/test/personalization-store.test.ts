import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptedNoProgressFixture,
  brandIdentifier,
  changePersonalizationConsent,
  createPersonalizationState,
  recordLearnerFeedback,
  type ActivePlanAggregate,
  type DomainResult,
  type IdentityAllocator,
  type PersonalizationState,
  type PlanId,
  type Timestamp,
} from '@openlearn/domain';
import {
  createPersonalizationStore,
  PERSONALIZATION_STORAGE_KEY,
  type PersonalizationStorage,
} from '../src/personalization-store.js';

const NOW = '2030-01-06T03:04:05Z' as Timestamp;
const LATER = '2030-01-06T03:05:05Z' as Timestamp;

class TestAllocator implements IdentityAllocator {
  private readonly counters = new Map<string, number>();

  allocate(kind: Parameters<IdentityAllocator['allocate']>[0]): string {
    const next = (this.counters.get(kind) ?? 0) + 1;
    this.counters.set(kind, next);
    return `dashboard-${kind}-${next}`;
  }
}

const expectSuccess = <T>(result: DomainResult<T>): T => {
  assert.equal(result.ok, true);
  if (!result.ok) {
    throw new Error(`expected success, received ${result.category}`);
  }
  return result.value;
};

const createStorage = (
  initial: Record<string, string> = {},
): PersonalizationStorage => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};

const rekeyPlan = (plan: ActivePlanAggregate, value: string): ActivePlanAggregate => {
  const result = brandIdentifier('plan', value);
  if (!result.ok) {
    throw new Error('invalid test plan');
  }
  const planId = result.value as PlanId;
  return {
    ...plan,
    planId,
    progress: plan.progress.map((record) => ({ ...record, planId })),
  };
};

const enabledState = (plan: ActivePlanAggregate): PersonalizationState =>
  expectSuccess(
    changePersonalizationConsent({
      state: expectSuccess(
        createPersonalizationState({
          ownerId: plan.ownerId,
          planId: plan.planId,
          now: NOW,
        }),
      ),
      action: 'enable',
      now: NOW,
    }),
  );

test('round-trips only the minimal owner/plan personalization aggregate', () => {
  const plan = acceptedNoProgressFixture();
  const storage = createStorage();
  const store = createPersonalizationStore(storage);
  const initial = enabledState(plan);
  const recorded = expectSuccess(
    recordLearnerFeedback({
      plan,
      state: initial,
      ownerId: plan.ownerId,
      itemId: 'fixture-item-reading',
      area: 'difficulty',
      value: 'too_hard',
      recordedAt: LATER,
      allocator: new TestAllocator(),
    }),
  );

  assert.deepEqual(store.save(initial, 0), { ok: true });
  assert.deepEqual(store.save(recorded.state, initial.stateVersion), { ok: true });
  const raw = storage.getItem(PERSONALIZATION_STORAGE_KEY);
  assert.equal(raw === null, false);
  if (raw === null) {
    throw new Error('expected personalization storage');
  }
  assert.equal(raw.includes('milestones'), false);
  assert.equal(raw.includes('too_hard'), true);
  assert.deepEqual(store.hydrate(plan, NOW).feedback, recorded.state.feedback);
});

test('keeps personalization entries for other plans isolated and preserves them', () => {
  const first = rekeyPlan(acceptedNoProgressFixture(), 'personalization-plan-a');
  const second = rekeyPlan(acceptedNoProgressFixture(), 'personalization-plan-b');
  const store = createPersonalizationStore(createStorage());
  const firstState = enabledState(first);
  const secondState = enabledState(second);

  assert.deepEqual(store.save(firstState, 0), { ok: true });
  assert.deepEqual(store.save(secondState, 0), { ok: true });
  assert.equal(store.hydrate(first, NOW).consent.state, 'enabled');
  assert.equal(store.hydrate(second, NOW).consent.state, 'enabled');
});

test('fails closed on malformed or cross-plan records without leaking plan content', () => {
  const plan = rekeyPlan(acceptedNoProgressFixture(), 'personalization-plan-safe');
  const storage = createStorage({
    [PERSONALIZATION_STORAGE_KEY]: JSON.stringify({
      version: 1,
      plans: {
        [plan.planId]: {
          ownerId: plan.ownerId,
          planId: plan.planId,
          stateVersion: 1,
          consent: {
            ownerId: plan.ownerId,
            planId: plan.planId,
            state: 'enabled',
            consentVersion: 1,
            updatedAt: NOW,
          },
          feedback: [
            {
              ownerId: plan.ownerId,
              planId: 'other-plan',
              feedbackId: 'feedback-foreign',
              area: 'difficulty',
              value: 'too_hard',
              recordedAt: NOW,
              consentVersion: 1,
              status: 'active',
            },
          ],
          proposals: [],
          milestones: [{ title: 'must not hydrate' }],
        },
        'foreign-plan': { milestones: [{ title: 'must not persist' }] },
      },
    }),
  });

  const hydrated = createPersonalizationStore(storage).hydrate(plan, NOW);
  assert.equal(hydrated.consent.state, 'disabled');
  assert.deepEqual(hydrated.feedback, []);
  assert.equal(storage.getItem(PERSONALIZATION_STORAGE_KEY)?.includes('milestones'), true);
});

test('detects compare-and-set conflicts and prevents stale pre-revoke resurrection', () => {
  const plan = acceptedNoProgressFixture();
  const storage = createStorage();
  const store = createPersonalizationStore(storage);
  const initial = enabledState(plan);
  const feedback = expectSuccess(
    recordLearnerFeedback({
      plan,
      state: initial,
      ownerId: plan.ownerId,
      area: 'relevance',
      value: 'not_relevant',
      recordedAt: LATER,
      allocator: new TestAllocator(),
    }),
  );
  assert.deepEqual(store.save(initial, 0), { ok: true });
  assert.deepEqual(store.save(feedback.state, initial.stateVersion), { ok: true });

  const revoked = expectSuccess(
    changePersonalizationConsent({
      state: feedback.state,
      action: 'revoke',
      now: LATER,
    }),
  );
  assert.deepEqual(store.save(revoked, feedback.state.stateVersion), { ok: true });
  assert.deepEqual(store.save(feedback.state, initial.stateVersion), {
    ok: false,
    kind: 'conflict',
  });
  const hydrated = store.hydrate(plan, NOW);
  assert.equal(hydrated.consent.state, 'revoked');
  assert.deepEqual(hydrated.feedback, []);
});

test('falls back safely when storage is unavailable or throws', () => {
  const plan = acceptedNoProgressFixture();
  const store = createPersonalizationStore({
    getItem: () => null,
    setItem: () => {
      throw new Error('quota');
    },
  });
  assert.equal(store.hydrate(plan, NOW).consent.state, 'disabled');
  assert.deepEqual(store.save(enabledState(plan), 0), { ok: false });
});
