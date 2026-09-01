# Phase 8 Personalization and Learner Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Phase 8 first slice: consent-gated, bounded learner feedback and deterministic, explainable, suggestion-only personalization that never mutates an accepted plan or confirmed progress automatically.

**Architecture:** Keep personalization as a separate domain aggregate keyed by owner and plan. The domain owns consent, feedback, proposal, expiry, decision, withdrawal, and revision-handoff rules. The application package adds capability-scoped use cases and a compare-and-set persistence port. The dashboard supplies a browser-local adapter with a dedicated storage key and maps the aggregate into accessible presentation-only controls. The connected AI client and production persistence remain behind future adapters.

**Tech Stack:** TypeScript 5.9, Node built-in test runner, React 19, Vite 7, pnpm workspaces, existing `@openlearn/domain`, `@openlearn/application`, and `@openlearn/ui` packages.

**Spec:** `docs/superpowers/specs/2026-09-01-openlearn-phase-8-personalization-and-learner-feedback-design.md`

## Global Constraints

- Personalization is disabled by default and scoped to one owner and one plan.
- Only confirmed progress and the three bounded feedback areas are eligible inputs.
- No free-text notes, conversation history, embeddings, sensitive traits, cross-plan profile, credentials, or raw feedback in telemetry/storage outside the dedicated minimal aggregate.
- Pausing stops evaluation, proposal generation, and new feedback capture; it never changes confirmed progress or accepted plan content.
- Revocation withdraws unresolved proposals, removes feedback from future evaluation, and prevents old records from being reused after re-enable.
- Proposal evaluation is deterministic and suggestion-only. Proposal acceptance changes proposal/request state only; a separately submitted plan revision must still use the existing validation path.
- Mutations must fail atomically on owner, plan, item, revision, consent-version, expiry, and optimistic-version conflicts.
- Preserve all unrelated worktree changes. Use `apply_patch` for edits, run focused checks after each task, and remove only generated `apps/dashboard/dist-test` output when needed.

---

## Task 1: Add domain personalization contracts and consent lifecycle

**Files:**
- Modify: `packages/domain/src/types.ts`
- Modify: `packages/domain/src/identity.ts`
- Modify: `packages/domain/src/errors.ts`
- Modify: `packages/domain/src/index.ts`
- Create: `packages/domain/src/personalization.ts`
- Test: `packages/domain/test/personalization.test.ts`
- Modify: `packages/domain/test/primitives.test.ts`

- [ ] Write failing tests for `createPersonalizationState`, disabled-by-default consent, owner/plan scoping, enable, pause, resume, revoke, re-enable with a new consent version, and invalid transitions.
- [ ] Write failing tests proving pause/revoke do not alter `ActivePlanAggregate` content or progress and that revoked state cannot be reused by a stale command.
- [ ] Add branded `FeedbackId` and `ProposalId` types and `feedback`/`proposal` identity namespaces; update primitive export/allocation expectations.
- [ ] Add domain value types for consent state, bounded feedback areas/values, feedback lifecycle, proposal kinds/parameters/bases/status, personalization state, and opaque revision handoff.
- [ ] Add only the necessary structured error category/code for stale personalization versions or proposal expiry, preserving safe detail fields and existing public error behavior.
- [ ] Implement pure consent transitions with timestamp/owner/plan validation and monotonic consent versions. Keep the initial disabled state at version zero; re-enable after revoke starts a new version.
- [ ] Export the new contracts and functions through the domain public entry point.
- [ ] Run `pnpm --filter @openlearn/domain test` and its typecheck; confirm existing domain suites remain green.

## Task 2: Implement bounded feedback, deterministic evaluation, and proposal decisions in the domain

**Files:**
- Modify: `packages/domain/src/personalization.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/test/personalization.test.ts`

- [ ] Write failing tests for accepting exactly the allowed difficulty, pace, and relevance values; rejecting malformed values, free-text notes, deleted plans, wrong owners/plans/items, and missing current-plan items.
- [ ] Write failing tests for correction as a new linked record, deletion as immediate logical removal, consent-version matching, paused capture rejection, and feedback exclusion after revoke/delete/correction.
- [ ] Write failing tests for deterministic proposal priority: relevance creates a bounded revision request, difficulty/pace creates a bounded pacing suggestion, and confirmed progress can recommend an existing next step. Assert explanations name only safe basis categories and contain no raw feedback or plan content.
- [ ] Write failing tests proving proposals are current-revision/current-plan scoped, expire without revival, deduplicate equivalent active proposals, and expose only the three defined proposal kinds.
- [ ] Write failing tests for accept/reject, expected proposal-version conflicts, source-revision conflicts, withdrawn/expired proposals, opaque pacing/revision handoffs, and the invariant that accepted plans and progress are byte-for-byte unchanged.
- [ ] Implement runtime validation helpers, feedback record/correction/delete transitions, proposal TTL/expiry, deterministic evaluation, and proposal decision transitions. Increment aggregate/proposal versions only on successful state transitions.
- [ ] Make revoke withdraw unresolved proposals and clear feedback eligibility; ensure a later consent version cannot evaluate or resurrect old records.
- [ ] Run the focused domain test file plus the complete domain package test/typecheck suite.

## Task 3: Add application capability and compare-and-set use cases

**Files:**
- Modify: `packages/application/src/contracts.ts`
- Modify: `packages/application/src/ports.ts`
- Modify: `packages/application/src/index.ts`
- Create: `packages/application/src/personalization.ts`
- Test: `packages/application/test/personalization.test.ts`
- Modify: `packages/application/test/contracts.test.ts`

- [ ] Extend capability contracts with `personalization:read` and `personalization:write` and add application input/result types without exposing transport, credential, provider, or raw-feedback types.
- [ ] Define `PersonalizationStatePort` with owner/plan reads, expected aggregate-version writes, and purge; represent storage conflicts explicitly.
- [ ] Write failing tests that each use case rejects before plan/personalization access when capability is missing and never discloses another owner’s state.
- [ ] Write failing tests for get/default state, consent mutations, feedback record/correct/delete, evaluate/list, proposal decisions, and purge/revoke. Include stale aggregate/proposal version conflicts, idempotency-key validation where a mutation input has one, and safe application errors.
- [ ] Implement `createPersonalizationApplication` using the existing clock, operation ID generator, actor context, `ApplicationStatePort.readPlan`, domain functions, and the new personalization port. Use the current accepted revision as the domain fence and return an opaque handoff for accepted pacing/revision proposals.
- [ ] Keep plan writes out of every personalization path; only the future connected AI client may turn a handoff into a candidate that re-enters existing plan validation.
- [ ] Export the application factory, port, inputs, and result types; update application README capability/use-case summary if needed.
- [ ] Run the application package typecheck and test suite, including all pre-existing lifecycle/use-case tests.

## Task 4: Build the isolated browser personalization adapter

**Files:**
- Create: `apps/dashboard/src/personalization-store.ts`
- Test: `apps/dashboard/test/personalization-store.test.ts`
- Modify: `apps/dashboard/tsconfig.json`
- Modify: `apps/dashboard/package.json` only if the workspace application package is imported directly

- [ ] Write failing tests for round-trip consent/feedback/proposals without plan content, preservation of other plan entries, malformed/foreign/cross-plan records being ignored, and storage read/write failures failing closed.
- [ ] Write failing tests for compare-and-set conflicts and for revoke/purge ensuring a stale pre-revoke state cannot resurrect feedback or proposals.
- [ ] Implement a dedicated versioned key `openlearn.dashboard.personalization.v1`; persist only the owner/plan-scoped personalization aggregate and bounded values.
- [ ] Validate hydrated records at the adapter boundary using domain branding/transition-safe shapes; never hydrate records belonging to another owner or plan.
- [ ] Provide the small adapter API needed by the application/dashboard (`hydrate`, `save`, and `purge`/CAS result) while keeping browser storage out of domain/application packages.
- [ ] Run the dashboard focused adapter tests and typecheck.

## Task 5: Add presentation models and accessible personalization controls

**Files:**
- Modify: `packages/ui/src/models.ts`
- Modify: `packages/ui/src/components.tsx`
- Modify: `packages/ui/src/index.ts`
- Modify: `packages/ui/styles.css`
- Test: `apps/dashboard/src/view-model.ts` and `apps/dashboard/test/view-model.test.ts` as needed

- [ ] Add presentation-only consent, feedback, proposal, basis, decision, and handoff view models. Keep domain/application records out of JSX props.
- [ ] Add a `PersonalizationPanel` with explicit enable explanation, plan scope, pause/resume, disable, bounded feedback selectors, correction/delete affordances, proposal explanation/basis, accept/not-useful controls, and status announcements.
- [ ] Render accepted revision requests as awaiting external plan revision, never as a changed plan. Preserve visible learner-confirmed progress and existing trust/recovery states.
- [ ] Ensure all controls have accessible names, keyboard operation, visible focus, live status, text labels independent of color, and reduced-motion-safe behavior.
- [ ] Add minimal responsive styles using existing tokens; do not introduce a new UI dependency.
- [ ] Run UI/dashboard typechecks and existing view-model tests; verify the component exports stay presentation-only.

## Task 6: Integrate personalization into the static dashboard

**Files:**
- Modify: `apps/dashboard/src/app.tsx`
- Modify: `apps/dashboard/src/view-model.ts`
- Modify: `apps/dashboard/src/app.css` only when dashboard-specific layout needs it
- Test: `apps/dashboard/test/view-model.test.ts` and new focused pure helper tests if required

- [ ] Create one browser-local personalization adapter per app instance and hydrate state by selected owner/plan, defaulting to disabled without blocking plan/progress rendering.
- [ ] Wire enable, pause/resume, revoke, bounded feedback, correction/delete, evaluate, accept/reject, and refresh/recovery actions through the adapter/domain/application boundary.
- [ ] Re-evaluate only after enabled feedback/progress changes; do not evaluate or capture new feedback while paused/revoked.
- [ ] Keep personalization state separate from `openlearn.dashboard.progress.v1` and ensure progress actions still work with personalization disabled, paused, unavailable, or storage-failed.
- [ ] Show safe success/conflict/retry messages and retain the last accepted plan on every failed or uncertain personalization action.
- [ ] Add deterministic fixture-preview coverage for a suggestion, pause/disable, and accepted revision-request handoff without changing the fixture plan.
- [ ] Run dashboard tests and typecheck, then manually inspect the built dashboard if the local dev/build command is available.

## Task 7: Verify governance, review the diff, and hand off the branch

**Files:**
- Modify: `docs/phases/phase-08-personalization-and-learner-feedback.md` only if implementation status should be updated after verification
- Modify: package READMEs only for finalized public API documentation

- [ ] Add/confirm tests for deletion retention metadata using the existing Phase 2 retention baseline: immediate logical removal, primary purge within 24 hours, backup expiry at 35 days, redacted telemetry at 30 days, and audit metadata at 90 days. Do not add raw feedback telemetry.
- [ ] Run `git diff --check`, all package tests/typechecks/builds via `pnpm run verify`, and remove only generated test output.
- [ ] Inspect the final diff for cross-plan leakage, automatic plan mutation, raw feedback persistence/logging, missing capability checks, unsafe status wording, and accessibility regressions.
- [ ] Use the verification-before-completion checklist and request a focused code review of the final Phase 8 diff.
- [ ] Commit implementation changes with a focused message. Do not push, merge, or alter `main`; report the branch, commit, verification results, and any environment limitation so the user can choose the PR/merge step.
