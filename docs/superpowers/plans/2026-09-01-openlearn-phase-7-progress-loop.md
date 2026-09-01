# Phase 7 Progress Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the deterministic dashboard to domain-backed learner progress actions that persist safely in the current browser and recalculate visible progress from the hydrated aggregate.

**Architecture:** Keep `@openlearn/domain` as the authority for progress transitions and optimistic checks. Add a browser-host adapter in `apps/dashboard` that persists only validated progress records through an injected storage interface, then hydrate static aggregates and derive snapshots from current app state. Keep the production PostgreSQL/service path deferred behind the existing application ports.

**Tech Stack:** TypeScript, React 19, Vite, `@openlearn/domain`, Node’s built-in `node:test`, pnpm workspaces, and browser `localStorage` through a small injected interface.

**Spec:** `docs/superpowers/specs/2026-09-01-openlearn-phase-7-interactive-learning-and-progress-design.md`

## Global Constraints

- Use `applyProgressAction` from `@openlearn/domain` for every learner transition; the dashboard must not invent progress state.
- Persist only learner progress records under the versioned key `openlearn.dashboard.progress.v1`; do not persist plan content, credentials, external request payloads, or operation metadata.
- Invalid or unavailable browser storage falls back to the known fixture aggregate; a failed write must leave confirmed in-memory state unchanged.
- The product brief’s minimum lovable product includes completion and undo; edit and reorder behavior remain out of scope for this increment.
- The dashboard remains a deterministic static preview and must continue to say that no live service is connected.
- Run tests with the repository’s existing pnpm scripts; the manifest requires Node `>=24.0.0 <25.0.0`.

---

### Task 1: Add validated browser progress persistence

**Files:**
- Create: `apps/dashboard/src/progress-store.ts`
- Create: `apps/dashboard/test/progress-store.test.ts`

**Interfaces:**
- Consumes: `ActivePlanAggregate` from `@openlearn/domain` and a storage-like object with `getItem`/`setItem`.
- Produces: `PROGRESS_STORAGE_KEY`, `DashboardStorage`, `ProgressStore`, and `createProgressStore(storage?: DashboardStorage)` for the dashboard wiring and later tests.

- [ ] **Step 1: Write the failing round-trip and isolation tests**

Add an in-memory storage helper and assert that a saved aggregate hydrates with the same progress, that the JSON document contains progress records but no plan content, and that saving one plan preserves another plan’s records:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptedCompleteFixture,
  acceptedNoProgressFixture,
  progressInProgressFixture,
} from '@openlearn/domain';
import {
  createProgressStore,
  PROGRESS_STORAGE_KEY,
  type DashboardStorage,
} from '../src/progress-store.js';

const createStorage = (
  initial: Record<string, string> = {},
): DashboardStorage => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
};

const noProgressPlan = () => acceptedNoProgressFixture();
const completedPlan = () => acceptedCompleteFixture();
const startedPlan = () => progressInProgressFixture().plan;

test('round-trips progress records without persisting plan content', () => {
  const storage = createStorage();
  const store = createProgressStore(storage);
  const plan = completedPlan();

  assert.deepEqual(store.save(plan), { ok: true });
  const raw = storage.getItem(PROGRESS_STORAGE_KEY);
  assert.ok(raw !== null);
  assert.equal(raw.includes('Learn the foundations of the web'), false);
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
```

Run: `pnpm --filter @openlearn/dashboard test`

Expected: FAIL because `progress-store.ts` and its exported interfaces do not exist yet.

- [ ] **Step 2: Verify the tests fail for the missing store**

Run the command above and confirm the failure is an import/export failure for `progress-store.ts`, not a test syntax or fixture failure.

- [ ] **Step 3: Write the failing corruption and write-failure tests**

Extend `apps/dashboard/test/progress-store.test.ts` with these behaviors:

```ts
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
```

Run: `pnpm --filter @openlearn/dashboard test`

Expected: FAIL because the store implementation is still absent.

- [ ] **Step 4: Implement the minimal validated store**

Create `apps/dashboard/src/progress-store.ts` with this shape:

```ts
export const PROGRESS_STORAGE_KEY = 'openlearn.dashboard.progress.v1';

export interface DashboardStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ProgressStore {
  hydrate(plan: ActivePlanAggregate): ActivePlanAggregate;
  save(plan: ActivePlanAggregate): { readonly ok: true } | { readonly ok: false };
}

export const createProgressStore = (
  storage?: DashboardStorage,
): ProgressStore;
```

Use `brandIdentifier`, `validateTimestamp`, and the plan’s current item IDs to validate stored records. Accept only supported states, non-negative safe-integer versions, unique current item IDs, matching owner/plan IDs, and valid `lastConfirmedAt` values. Treat malformed JSON or a malformed root as an empty read for hydration and a failed write for save when preserving the document would be unsafe.

- [ ] **Step 5: Run the store tests to verify green**

Run: `pnpm --filter @openlearn/dashboard test`

Expected: all progress-store tests pass and existing dashboard tests remain green.

- [ ] **Step 6: Commit the storage deliverable**

```text
git add apps/dashboard/src/progress-store.ts apps/dashboard/test/progress-store.test.ts
git commit -m phase7-progress-store
```

### Task 2: Add a domain-backed dashboard action adapter

**Files:**
- Create: `apps/dashboard/src/progress-actions.ts`
- Create: `apps/dashboard/test/progress-actions.test.ts`

**Interfaces:**
- Consumes: `ActivePlanAggregate`, `effectiveProgress`, `brandIdentifier`, and `applyProgressAction` from `@openlearn/domain`.
- Produces: `DashboardProgressAction`, `ApplyDashboardProgressActionInput`, `DashboardProgressActionResult`, and `applyDashboardProgressAction(input)` for `App`.

- [ ] **Step 1: Write failing transition and conflict tests**

Define the desired dashboard-facing mapping and assert that it returns a new aggregate for all three actions:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptedCompleteFixture,
  acceptedNoProgressFixture,
} from '@openlearn/domain';
import {
  applyDashboardProgressAction,
} from '../src/progress-actions.js';

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
```

The optional `expectedRevisionId` and `expectedProgressVersion` fields make stale compare-and-set behavior directly testable while the dashboard omits them and defaults to the current aggregate values.

Run: `pnpm --filter @openlearn/dashboard test`

Expected: FAIL because `progress-actions.ts` is missing.

- [ ] **Step 2: Implement the minimal adapter**

Create `progress-actions.ts` with:

```ts
export type DashboardProgressAction = 'start' | 'complete' | 'undo_completion';

export interface ApplyDashboardProgressActionInput {
  readonly plan: ActivePlanAggregate;
  readonly itemId: string;
  readonly action: DashboardProgressAction;
  readonly confirmedAt: string;
  readonly expectedRevisionId?: string;
  readonly expectedProgressVersion?: number;
}

export type DashboardProgressActionResult =
  | { readonly ok: true; readonly plan: ActivePlanAggregate; readonly message: string }
  | { readonly ok: false; readonly kind: 'conflict' | 'unavailable'; readonly message: string };
```

Brand the item ID and revision when the optional compare-and-set inputs are supplied. When they are omitted, use the aggregate’s current revision ID and the selected item’s effective progress version. Map `start` to `start_item`, `complete` to `complete_item`, and `undo_completion` to `undo_completion`, then call `applyProgressAction`. Map stale revision/progress failures to `conflict`; map invalid membership, invalid transition, malformed input, owner, and deletion failures to `unavailable`. Return action-specific learner-readable success messages.

- [ ] **Step 3: Run the adapter tests to verify green**

Run: `pnpm --filter @openlearn/dashboard test`

Expected: all adapter and existing dashboard tests pass.

- [ ] **Step 4: Commit the action deliverable**

```text
git add apps/dashboard/src/progress-actions.ts apps/dashboard/test/progress-actions.test.ts
git commit -m phase7-progress-actions
```

### Task 3: Extend the UI contract for start, completion, undo, and feedback

**Files:**
- Modify: `packages/ui/src/models.ts`
- Modify: `packages/ui/src/components.tsx`
- Modify: `apps/dashboard/src/view-model.ts`
- Test: `apps/dashboard/test/view-model.test.ts`

**Interfaces:**
- Consumes: `DashboardProgressAction` semantics from Task 2 and existing `PlanItemViewModel`/`PlanDetailViewModel` contracts.
- Produces: a `LearnerActionKind` containing `start`, an action callback carrying `(itemId, action)`, and an optional progress feedback message rendered by `DashboardDetail`.

- [ ] **Step 1: Write failing view-model assertions**

Add tests that a not-started item has `kind === 'start'` and label `Start item`, an in-progress item has `kind === 'complete'` and label `Mark complete`, and a completed item retains `undo_completion`. Add a test that a `failed_retryable` action remains enabled so the learner can retry.

Run: `pnpm --filter @openlearn/dashboard test`

Expected: FAIL because the current mapper labels every non-completed item `Mark complete` and only enables `available` actions.

- [ ] **Step 2: Implement the minimal model and component changes**

Update `LearnerActionKind` and `toAction` as follows:

```ts
const actionForState = (state: LearnerProgressState): {
  readonly kind: LearnerActionKind;
  readonly label: string;
} => state === 'not_started'
  ? { kind: 'start', label: 'Start item' }
  : state === 'in_progress'
    ? { kind: 'complete', label: 'Mark complete' }
    : { kind: 'undo_completion', label: 'Undo completion' };
```

Keep `conflict` and `unavailable` disabled, but allow `failed_retryable` and `available`. Change `PlanItemDetailProps.onProgressAction` and `DashboardDetailProps.onProgressAction` to `(itemId: string, action: LearnerActionKind) => void`, and pass `item.action.kind` from `PlanItemDetail`. Add an optional `progressMessage` to `PlanDetailViewModel`/`ViewModelOptions`, and pass it to the existing `ProgressSummary` `actionMessage` prop.

- [ ] **Step 3: Run dashboard and UI type/tests to verify green**

Run: `pnpm --filter @openlearn/dashboard test` and `pnpm --filter @openlearn/ui typecheck`

Expected: all tests and type checks pass.

- [ ] **Step 4: Commit the UI contract deliverable**

```text
git add packages/ui/src/models.ts packages/ui/src/components.tsx apps/dashboard/src/view-model.ts apps/dashboard/test/view-model.test.ts
git commit -m phase7-ui-progress-contract
```

### Task 4: Hydrate dynamic dashboard state and wire learner actions

**Files:**
- Modify: `apps/dashboard/src/seed-data.ts`
- Modify: `apps/dashboard/src/app.tsx`
- Modify: `apps/dashboard/src/view-model.ts`
- Test: `apps/dashboard/test/view-model.test.ts`
- Test: `apps/dashboard/test/seed-data.test.ts`

**Interfaces:**
- Consumes: `createProgressStore` from Task 1, `applyDashboardProgressAction` from Task 2, and the UI action contract from Task 3.
- Produces: a dashboard that derives list/detail snapshots from current hydrated aggregates, persists successful learner actions, recalculates the next action, and exposes safe retry/conflict feedback.

- [ ] **Step 1: Write failing current-aggregate snapshot assertions**

Add `apps/dashboard/test/seed-data.test.ts` with a test for the new `snapshotOfPlan` export:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptedCompleteFixture } from '@openlearn/domain';
import { snapshotOfPlan } from '../src/seed-data.js';

test('snapshotOfPlan reflects progress from the supplied aggregate', () => {
  const snapshot = snapshotOfPlan(acceptedCompleteFixture());
  assert.equal(snapshot.progressSummary.completedCount, 1);
  assert.equal(
    snapshot.currentProgress.find((record) => record.itemId === 'fixture-item-reading')?.state,
    'completed_by_learner',
  );
  assert.equal(snapshot.nextItemId, 'fixture-item-request-flow');
});
```

Run: `pnpm --filter @openlearn/dashboard test`

Expected: FAIL because `snapshotOfPlan` is not exported yet.

- [ ] **Step 2: Add a safe snapshot helper for current aggregates**

Export from `seed-data.ts` a helper with this signature:

```ts
export const snapshotOfPlan = (
  plan: ActivePlanAggregate,
  ownerId: InternalOwnerId = plan.ownerId,
): AcceptedPlanSnapshotInput => {
  const result = readOwnedAcceptedSnapshot(plan, ownerId);
  if (!result.ok) {
    throw new Error(`invalid static snapshot: ${result.category}`);
  }
  return result.value as AcceptedPlanSnapshotInput;
};
```

Use it in `App` to derive `snapshots` and `snapshotById` from the hydrated plan state. Keep the static map only for explicit preview states that intentionally select a fixture.

- [ ] **Step 3: Hydrate the static aggregates on app startup**

Create one `ProgressStore` with `createProgressStore(window.localStorage)` behind a guarded `try/catch`. Initialize a `Map<string, ActivePlanAggregate>` by calling `store.hydrate` for each `STATIC_PLANS` entry. Derive `selectedPlan` and list/detail snapshots from this map instead of `STATIC_PLANS` and `STATIC_SNAPSHOTS` directly.

- [ ] **Step 4: Wire the progress callback through domain and persistence**

Change `progressAction` to receive `(itemId, action)`. On the selected current plan:

```ts
setActionStates((states) => ({ ...states, [itemId]: 'submitting' }));
const result = applyDashboardProgressAction({
  plan,
  itemId,
  action,
  confirmedAt: new Date().toISOString(),
});
if (!result.ok) {
  setActionStates((states) => ({
    ...states,
    [itemId]: result.kind === 'conflict' ? 'conflict' : 'unavailable',
  }));
  setProgressMessage(result.message);
  return;
}
if (!progressStore.save(result.plan).ok) {
  setActionStates((states) => ({ ...states, [itemId]: 'failed_retryable' }));
  setProgressMessage('Your confirmed progress is unchanged. Try again when ready.');
  return;
}
setPlans((plans) => new Map(plans).set(result.plan.planId, result.plan));
setActionStates((states) => ({ ...states, [itemId]: 'available' }));
setProgressMessage(result.message);
```

Keep failed/conflicted aggregates out of state updates. Make `refresh` rehydrate every static plan from the same store before clearing action states and messages. Pass the per-plan feedback into `toPlanDetailViewModel` and update the static notice/footer to say that progress is stored in this browser while no live service is connected.

- [ ] **Step 5: Run the dashboard tests and build**

Run: `pnpm --filter @openlearn/dashboard test` and `pnpm --filter @openlearn/dashboard build`

Expected: all dashboard tests pass and Vite produces a successful build.

- [ ] **Step 6: Commit the wired dashboard deliverable**

```text
git add apps/dashboard/src/seed-data.ts apps/dashboard/src/app.tsx apps/dashboard/src/view-model.ts apps/dashboard/test/view-model.test.ts
git commit -m phase7-dashboard-progress
```

### Task 5: Full verification and handoff

**Files:**
- Modify: none unless verification exposes an implementation defect.

**Interfaces:**
- Consumes: all Phase 7 increment deliverables.
- Produces: verified source state and a concise implementation handoff that names the browser-only limitation.

- [ ] **Step 1: Run the focused package suites**

Run:

```text
pnpm --filter @openlearn/domain test
pnpm --filter @openlearn/application test
pnpm --filter @openlearn/dashboard test
pnpm --filter @openlearn/ui typecheck
```

Expected: all tests pass. The current runtime may emit the existing Node engine warning because the manifest requires Node 24 and the available runtime is Node 22; do not hide or reinterpret that warning.

- [ ] **Step 2: Run workspace verification**

Run: `pnpm run verify`

Expected: typecheck, all package tests, and all builds pass. Remove only generated untracked test/build output such as `apps/dashboard/dist-test/` after inspection.

- [ ] **Step 3: Review the final diff**

Run: `git diff --check` and `git status --short`. Confirm the diff contains only the Phase 7 design/plan and implementation files, and that no secrets, raw payloads, or unrelated files were changed.

- [ ] **Step 4: Commit the verified implementation**

```text
git add apps/dashboard/src apps/dashboard/test packages/ui/src docs/superpowers/plans/2026-09-01-openlearn-phase-7-progress-loop.md
git commit -m phase7-interactive-progress
```

Report that the dashboard progress loop is implemented for deterministic browser-local fixtures, and explicitly note that the production PostgreSQL adapter and live service/dashboard transport remain deferred.
