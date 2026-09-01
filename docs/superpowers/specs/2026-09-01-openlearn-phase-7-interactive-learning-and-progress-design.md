# OpenLearn Phase 7 Interactive Learning and Progress Design

**Status:** Approved direction; implementation review pending

**Goal:** Turn the existing static dashboard into a small, testable learner-progress loop that survives browser reloads while keeping the domain model as the source of truth.

## Scope

This first Phase 7 increment delivers the minimum lovable progress journey for the deterministic dashboard fixtures:

- inspect an ordered plan and focus an item;
- start an item, complete an in-progress item, and undo a completion;
- persist learner progress in the current browser across reloads;
- recalculate progress summaries and the next action from the persisted aggregate; and
- present safe, learner-readable success, conflict, and retryable-failure feedback.

The product brief explicitly keeps plan editing and reordering outside the minimum lovable product. This increment also does not add the production PostgreSQL adapter, a live dashboard service API, or a live MCP-to-dashboard connection. Those boundaries remain represented by the existing application ports and Phase 6 contracts.

## Existing foundation

- `packages/domain/src/progress.ts` already owns the allowed progress transitions, effective absent progress, optimistic progress-version checks, revision checks, ownership checks, and atomic failure behavior.
- `packages/application/src/use-cases.ts` already exposes an authorized progress mutation with idempotency and safe operation results.
- `apps/dashboard/src/view-model.ts` already maps accepted snapshots into ordered outline, progress, next-action, and learner-action view models.
- `apps/dashboard/src/app.tsx` currently renders deterministic fixtures, but its progress callback only changes an action to `submitting` and never changes or persists the aggregate.

## Architecture and data flow

The dashboard will use a narrow browser-side adapter for the static fixture only. The adapter is injected with a storage-like interface so it can be tested without a browser and so storage failures can be deterministic.

```text
stored progress -> hydrate fixture aggregate -> accepted snapshot -> view model -> UI
                                                ^                         |
                                                |                         v
                                      persist only after        learner intent with
                                      domain transition         current revision/version
```

### Domain transition authority

The presentation layer derives one action from the current domain progress state:

| Current state | UI action | Domain action |
| --- | --- | --- |
| `not_started` | `Start item` | `start_item` |
| `in_progress` | `Mark complete` | `complete_item` |
| `completed_by_learner` | `Undo completion` | `undo_completion` |

Every mutation supplies the aggregate's current revision ID, the selected item's effective progress version, and a UTC confirmation timestamp to `applyProgressAction`. The UI never invents a new progress state or bypasses this function.

### Browser progress store

`apps/dashboard/src/progress-store.ts` will define:

```ts
export interface DashboardStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ProgressStore {
  hydrate(plan: ActivePlanAggregate): ActivePlanAggregate;
  save(plan: ActivePlanAggregate): { readonly ok: true } | { readonly ok: false };
}
```

The JSON document uses the versioned key `openlearn.dashboard.progress.v1` and stores only learner progress records keyed by plan ID. It does not store plan content, credentials, external request payloads, or operation metadata.

Hydration accepts only records that belong to the supplied owner and plan, reference a current plan item, use a supported progress state, contain a non-negative safe-integer version, have a valid UTC confirmation timestamp, and do not duplicate an item. Invalid or unavailable storage falls back to the unmodified fixture aggregate. A save reads the valid document, replaces only the selected plan's progress records, and writes one JSON value; a storage exception returns `{ ok: false }` and leaves the in-memory aggregate unchanged.

### Dashboard state flow

The app hydrates all static plans once on startup. It derives list and detail snapshots from the current active aggregates rather than `STATIC_SNAPSHOTS`. On a learner intent it:

1. marks the item action as submitting;
2. applies the domain transition against the current aggregate;
3. persists the returned aggregate before changing confirmed UI state;
4. replaces the plan in app state and clears the submitting state on success; or
5. leaves the aggregate untouched and maps a domain conflict to `conflict` or a storage failure to `failed_retryable`.

Refresh rehydrates the plans from storage, which is the recovery path for a conflict. Successful transitions expose a short progress message naming the confirmed action. A failed storage write explicitly says that confirmed progress is unchanged and can be retried.

## UI contract changes

- `LearnerActionKind` gains `start`.
- The item action callback carries both the opaque item ID and the derived action kind, so the app cannot infer an action from display text.
- The view-model mapping labels actions as `Start item`, `Mark complete`, or `Undo completion` based on domain state.
- Retryable action failures remain retryable; conflicts remain disabled until refresh.
- The progress summary can announce the result of a confirmed or failed learner action without collapsing it into plan trust state.
- The static-preview notice/footer makes browser-local progress persistence explicit; it continues to state that no live service is connected.

## Error and recovery behavior

- Invalid item membership, invalid transitions, stale revision IDs, and stale progress versions never mutate the aggregate. The learner sees a conflict or unavailable action state and the last confirmed state remains visible.
- A storage read or JSON validation problem never renders untrusted stored records. The fixture remains usable from its known accepted state.
- A storage write failure never presents an unpersisted progress change as confirmed. The action is retryable.
- No optimistic completion is shown after a failed or uncertain write.

## Verification

Tests will cover:

- valid hydration and save round-trips, preservation of other plans, malformed JSON, invalid records, and thrown writes;
- the three progress action mappings and domain-backed transitions;
- stale progress conflict behavior with no state mutation;
- dynamic list/detail snapshots and recalculated progress/next action; and
- retryable action-state mapping and learner-readable feedback.

The existing domain, application, dashboard, and UI test suites must remain green. The browser adapter is deliberately a presentation-host adapter; its tests do not weaken the application-layer persistence and authorization contracts defined for production.

## Deferred work

Production Phase 7 completion still requires a durable PostgreSQL adapter and service/dashboard transport integration. Edit/reorder behavior, revision UI, and personalization remain later slices governed by the product brief and subsequent phase documents.

