import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptedCompleteFixture,
  acceptedNoProgressFixture,
  brandIdentifier,
  progressInProgressFixture,
  type ActivePlanAggregate,
  type PlanId,
} from '@openlearn/domain';
import {
  createProgressStore,
  PROGRESS_STORAGE_KEY,
  type DashboardStorage,
} from '../src/progress-store.js';

const rekeyPlan = (plan: ActivePlanAggregate, value: string): ActivePlanAggregate => {
  const result = brandIdentifier('plan', value);
  if (!result.ok) {
    throw new Error(`invalid test plan id: ${result.category}`);
  }
  const planId = result.value as PlanId;
  return {
    ...plan,
    planId,
    progress: plan.progress.map((record) => ({ ...record, planId })),
  };
};

const noProgressPlan = (): ActivePlanAggregate =>
  rekeyPlan(acceptedNoProgressFixture(), 'fixture-plan-primary');

const completedPlan = (): ActivePlanAggregate =>
  rekeyPlan(acceptedCompleteFixture(), 'fixture-plan-primary');

const startedPlan = (): ActivePlanAggregate =>
  rekeyPlan(progressInProgressFixture().plan, 'fixture-plan-secondary');

const startedPrimaryPlan = (): ActivePlanAggregate =>
  rekeyPlan(progressInProgressFixture().plan, 'fixture-plan-primary');

const createStorage = (
  initial: Record<string, string> = {},
): DashboardStorage => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};

test('round-trips progress records without persisting plan content', () => {
  const storage = createStorage();
  const store = createProgressStore(storage);
  const plan = completedPlan();

  assert.deepEqual(store.save(plan), { ok: true });
  const raw = storage.getItem(PROGRESS_STORAGE_KEY);
  assert.equal(raw === null, false);
  if (raw === null) {
    throw new Error('expected persisted progress document');
  }
  assert.equal(raw.includes('milestones'), false);
  assert.equal(raw.includes('fixture-item-reading'), true);
  assert.deepEqual(store.hydrate(noProgressPlan()).progress, plan.progress);
});

test('preserves progress for other plans when saving one plan', () => {
  const storage = createStorage();
  const store = createProgressStore(storage);
  const first = completedPlan();
  const second = startedPlan();

  assert.deepEqual(store.save(first), { ok: true });
  assert.deepEqual(store.save(second), { ok: true });
  assert.deepEqual(store.hydrate(first).progress, first.progress);
  assert.deepEqual(store.hydrate(second).progress, second.progress);
});

test('reports a conflict when persisted progress changed after the baseline was read', () => {
  const storage = createStorage();
  const store = createProgressStore(storage);
  const baseline = noProgressPlan();
  const externallyChanged = completedPlan();
  const candidate = startedPrimaryPlan();

  assert.deepEqual(store.save(baseline), { ok: true });
  assert.deepEqual(store.save(externallyChanged), { ok: true });
  assert.deepEqual(store.save(candidate, baseline), {
    ok: false,
    kind: 'conflict',
  });
  assert.deepEqual(store.hydrate(baseline).progress, externallyChanged.progress);
});

test('rechecks the target before writing so a concurrent update is not overwritten', () => {
  const baseline = noProgressPlan();
  const externallyChanged = completedPlan();
  const candidate = startedPrimaryPlan();
  const baselineRaw = JSON.stringify({
    version: 1,
    plans: { [baseline.planId]: baseline.progress },
  });
  const changedRaw = JSON.stringify({
    version: 1,
    plans: { [externallyChanged.planId]: externallyChanged.progress },
  });
  let reads = 0;
  let writes = 0;
  const storage: DashboardStorage = {
    getItem: () => {
      reads += 1;
      return reads === 1 ? baselineRaw : changedRaw;
    },
    setItem: () => {
      writes += 1;
    },
  };

  assert.deepEqual(createProgressStore(storage).save(candidate, baseline), {
    ok: false,
    kind: 'conflict',
  });
  assert.equal(writes, 0);
});

test('drops contaminated non-progress payloads before preserving other plan entries', () => {
  const plan = noProgressPlan();
  const storage = createStorage({
    [PROGRESS_STORAGE_KEY]: JSON.stringify({
      version: 1,
      plans: {
        'foreign-plan': { milestones: [{ title: 'content that must not persist' }] },
        [plan.planId]: [],
      },
    }),
  });

  assert.deepEqual(createProgressStore(storage).save(completedPlan()), { ok: true });
  const raw = storage.getItem(PROGRESS_STORAGE_KEY);
  if (raw === null) {
    throw new Error('expected persisted progress document');
  }
  const persisted = JSON.parse(raw) as { plans: Record<string, unknown> };
  assert.equal(Object.prototype.hasOwnProperty.call(persisted.plans, 'foreign-plan'), false);
  assert.equal(raw.includes('milestones'), false);
});

test('ignores malformed or unrelated stored records during hydration', () => {
  const storage = createStorage({
    [PROGRESS_STORAGE_KEY]: JSON.stringify({
      version: 1,
      plans: {
        [noProgressPlan().planId]: [
          { itemId: 'not-an-item', state: 'completed_by_learner', progressVersion: 1 },
          { itemId: 'fixture-item-reading', state: 'unknown', progressVersion: 1 },
        ],
      },
    }),
  });

  const hydrated = createProgressStore(storage).hydrate(noProgressPlan());
  assert.deepEqual(hydrated.progress, []);
});

test('falls back safely when storage is unavailable or throws on write', () => {
  const plan = completedPlan();
  const store = createProgressStore({
    getItem: () => null,
    setItem: () => {
      throw new Error('quota');
    },
  });

  assert.deepEqual(store.hydrate(noProgressPlan()), noProgressPlan());
  assert.deepEqual(store.save(plan), { ok: false });
  assert.deepEqual(store.hydrate(noProgressPlan()), noProgressPlan());
});
