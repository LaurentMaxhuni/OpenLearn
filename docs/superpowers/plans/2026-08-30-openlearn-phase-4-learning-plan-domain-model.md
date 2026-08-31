# Phase 4 Learning-plan Domain Model Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Implement a pure TypeScript domain package that validates canonical learning-plan content, models accepted revisions and learner-confirmed progress, enforces owner-scoped transitions and deletion, and exports deterministic contract fixtures without coupling to persistence, MCP, or UI.

**Architecture:** The domain package is a dependency-free aggregate and transition library. Candidate normalization is pure and bounded; accepted-plan replacement and learner actions return new aggregate values rather than mutating shared state. The application layer remains responsible for authentication adapters, transaction and idempotency orchestration, operation lifecycle, persistence, MCP envelopes, dashboard URLs, and mapping to packages/ui.

**Tech Stack:** pnpm workspace, Node.js 24 LTS, strict TypeScript, and Node's built-in node:test and node:assert/strict modules. No ORM, database client, MCP SDK, frontend framework, provider SDK, or runtime network dependency is introduced by Phase 4.

**Spec:** docs/superpowers/specs/2026-08-30-openlearn-phase-4-learning-plan-domain-model-design.md

## Global Constraints

- Work in the existing primary checkout and the normal branch phase-4-learning-plan-domain-model. Do not create or use a linked Git worktree.
- Preserve unrelated user changes and stop before editing an overlapping file if unrelated changes appear.
- Keep the implementation framework-neutral. The domain package must not import React, Vite, Fastify, an MCP SDK, PostgreSQL, an ORM, an OIDC/OAuth SDK, or a provider SDK.
- External AI clients own conversation, intent interpretation, curriculum generation, tutoring, and decisions about when to call OpenLearn. The package accepts and validates plan-shaped content only.
- Use the canonical aggregate tree: Plan, one required Goal, optional Context containing an optional summary and ordered ContextEntry values, ordered Milestones, ordered Topics, ordered PlanItems, and optional Resources on a PlanItem.
- Require one non-empty Goal with a non-empty title, one to fifty milestones, at least one topic per milestone, and at least one plan item per topic. The plan title, descriptions, Context, resources, and resource destinations are optional.
- Treat array order in a candidate as canonical. Do not sort by title, timestamps, identifiers, or persistence order.
- Normalize text with NFC, CRLF/CR to LF, tabs to one space, and edge trimming; preserve internal whitespace and line breaks. Reject NUL and other C0 controls.
- Enforce the exact identifier, text, URL, item-count, resource-count, and total-text bounds in the Phase 4 specification.
- Identifiers are opaque, exact, case-sensitive, non-empty branded values. Never derive an identifier from a title, array position, timestamp, database key, or provider identifier.
- Reject unknown fields, duplicate identifiers, invalid relationships, unsafe content, forbidden ownership or lifecycle fields, and candidates that exceed limits. Rejection is atomic.
- Accepted plans have an active or deleted lifecycle; only active plans have a current accepted revision. A candidate is never partially accepted.
- Accepted replacement is a full snapshot with optimistic concurrency against the current RevisionId. A stale revision must not overwrite accepted content or confirmed progress.
- Learner progress is only not_started, in_progress, or completed_by_learner. Operation status such as pending, conflict, or retryable failure is not progress state.
- Learner actions are explicit and learner-confirmed. Externally supplied or unvalidated completion claims never become confirmed progress.
- Every aggregate operation is owner-scoped. Unauthorized outcomes are non-disclosing and must not reveal whether a plan exists or whether it has an accepted revision.
- Deletion is an active-to-deleted transition with immediate access revocation, no optimistic resurrection, and primary-data purge within 24 hours. Delayed or retried requests must not recreate a deleted PlanId.
- Preserve Phase 2 retention and reconciliation commitments: 24-hour operation/replay detail expiry, 35-day mutation markers after account deletion, 30-day redacted telemetry, 90-day minimal security/ownership audit metadata, and backups expiring or being scrubbed within 35 days.
- Keep exact MCP tool names, wire envelopes, database schema, ORM choice, dashboard URLs, UI component props, identity-provider adapters, and operational telemetry implementation outside this phase.

## Task 1: Establish the workspace and domain-package test harness

**Files**

- Create package.json at the repository root.
- Create pnpm-workspace.yaml.
- Create tsconfig.json at the repository root.
- Create packages/domain/package.json.
- Create packages/domain/tsconfig.json.
- Create packages/domain/tsconfig.build.json.
- Create packages/domain/src/index.ts.

**Steps**

- [x] Add a private root workspace named openlearn with package manager pnpm 10.15.0, Node 24 engine bounds, and scripts for build, typecheck, test, and verify.
- [x] Configure the workspace packages globs as apps/* and packages/*.
- [x] Configure strict TypeScript with NodeNext module resolution, ES2024 target, noUncheckedIndexedAccess, exactOptionalPropertyTypes, noImplicitOverride, noFallthroughCasesInSwitch, forceConsistentCasingInFileNames, skipLibCheck, declaration, and verbatimModuleSyntax.
- [x] Configure the domain package as an ESM package named @openlearn/domain with build output in dist and scripts that build before running node:test against dist/test.
- [x] Keep the initial public entry point empty except for a harmless module boundary so the package can be typechecked before domain modules exist.
- [x] Install dependencies with the repository's selected pnpm version, producing a lockfile only if the install succeeds and does not overwrite unrelated lockfile work.
- [x] Run pnpm run typecheck, pnpm run test, and pnpm run build. Expected result: all three commands succeed with the empty package boundary.
- [x] Commit the harness as build: add domain package workspace.

## Task 2: Define domain primitives, aggregate types, limits, and errors

**Files**

- Create packages/domain/src/types.ts.
- Create packages/domain/src/limits.ts.
- Create packages/domain/src/errors.ts.
- Create packages/domain/src/identity.ts.
- Create packages/domain/test/primitives.test.ts.
- Update packages/domain/src/index.ts.

**Types and interfaces**

- [x] Define branded PlanId, RevisionId, GoalId, ContextEntryId, MilestoneId, TopicId, PlanItemId, ResourceId, and InternalOwnerId types. Use a single opaque brand pattern that cannot be satisfied accidentally by an arbitrary string in typed code.
- [x] Define Goal with stable id, title, and optional description. The accepted plan contains exactly one Goal; the domain does not add a primary-marker field.
- [x] Define ContextEntry with stable entryId, label, and normalized value. Define optional Context with an optional summary and an ordered readonly collection of entries.
- [x] Define Resource with stable id, required label, optional safe URL, and optional bounded opaqueReference. A label-only resource is valid.
- [x] Define PlanItem with stable id, title, optional description, and ordered resources.
- [x] Define Topic and Milestone as ordered containers with stable IDs, required titles, optional descriptions, and required non-empty child arrays.
- [x] Define CanonicalPlanContent as a normalized immutable snapshot with optional title, exactly one Goal, optional context, milestones, and no actor-controlled lifecycle or progress fields.
- [x] Define PlanLifecycle as active or deleted, ProgressState as not_started, in_progress, or completed_by_learner, and a progress record containing state, progressVersion, lastNonCompleteState when needed, and lastConfirmedAt.
- [x] Define AcceptedRevisionRef and PlanAggregate with ownerId, planId, lifecycle, current accepted revision or no current revision after deletion, and progress records.
- [x] Define a deletion tombstone containing plan identity, owner identity, deletion time, and the terminal revision reference needed to prevent resurrection without exposing content.
- [x] Define DomainErrorCategory with malformed_input, missing_required, invalid_identifier, duplicate_identifier, invalid_relationship, unsafe_content, too_large, unknown_field, stale_revision, stale_progress, invalid_transition, deletion_conflict, owner_unavailable, plan_deleted, and mutation_replay_conflict.
- [x] Define a discriminated DomainResult<T> success or failure union. Failure values must carry a stable category and safe human-independent details; they must not contain raw submitted content, credentials, provider claims, or cross-owner resource existence.
- [x] Define IdentifierKind and IdentityAllocator with allocate(kind) returning an opaque string. Keep allocation outside validation's authority boundary so callers can provide deterministic fixture allocators.

**Tests first**

- [x] Add a passing test for branding valid opaque identifiers without changing their case.
- [x] Add a failing test for empty identifiers, whitespace-padded identifiers, control characters, and overlong identifiers. Add a passing test that a readable slug-like identifier is accepted as opaque, remains exact and case-sensitive, and is never generated by the domain from presentation text.
- [x] Add tests that required type fields are present and readonly collections preserve their declared order.
- [x] Add tests for every error category's discriminant and safe detail shape.
- [x] Run the focused test before implementation and record the expected failure; implement the types and helpers; rerun the focused test, pnpm run typecheck, and pnpm run test.
- [x] Commit as feat: define learning plan domain primitives.

## Task 3: Normalize and validate plan candidates atomically

**Files**

- Create packages/domain/src/normalize.ts.
- Create packages/domain/src/validation.ts.
- Create packages/domain/test/normalize.test.ts.
- Create packages/domain/test/validation.test.ts.
- Update packages/domain/src/index.ts.

**Public behavior**

- [x] Define NormalizedPlanContent with the canonical content and deterministic missingOptionalPaths metadata for omitted optional descriptive content.
- [x] Implement normalizePlanContent(input: unknown, allocator: IdentityAllocator): DomainResult<NormalizedPlanContent>. It must be pure, bounded, synchronous, and free of persistence, network, and UI behavior.
- [x] Accept plan-shaped unknown input only. Allocate missing stable IDs for accepted entities through the supplied allocator; preserve supplied IDs after validating them.
- [x] Apply NFC normalization, line-ending normalization, tab normalization, and edge trimming to all textual values. Preserve internal whitespace and intentional line breaks.
- [x] Reject NUL and all disallowed C0 controls, unsafe URL schemes, credentials in URLs, malformed absolute URLs, and URL values over 2048 characters. Do not fetch or dereference URLs.
- [x] Enforce ShortText 1 to 240 characters, LongText 1 to 4000 characters, BoundedOpaqueText 1 to 512 characters, identifier length 1 to 128 characters, no more than 50 context entries, 1 to 50 milestones, 200 total topics, 1000 total plan items, 20 resources per item, and 200000 total normalized text characters.
- [x] Treat omitted optional descriptive values as absent and record their paths in missingOptionalPaths. Treat optional values that normalize to empty as absent. Reject empty required values.
- [x] Require one non-empty Goal with a non-empty title, one to fifty milestones, at least one topic per milestone, and at least one plan item per topic. Allow the plan title, context, descriptions, resources, and resource destinations to be absent.
- [x] Preserve all sibling array order exactly. Do not sort or deduplicate by title.
- [x] Reject unknown fields at every level and reject candidate attempts to set ownerId, lifecycle, planId, revisionId, progress, operation state, deletion state, timestamps, or other accepted-state fields.
- [x] Reject duplicate IDs across the relevant entity namespace and reject invalid parent-child references. A duplicate or relationship error rejects the entire candidate.
- [x] Accept a resource with a label only, a safe URL only, or a bounded opaqueReference only when it has a meaningful displayable or referenceable value. Keep opaqueReference non-navigational.
- [x] Return a stable category and path-oriented safe detail for malformed, missing-required, invalid-identifier, duplicate-identifier, invalid-relationship, unsafe-content, too-large, and unknown-field failures. Do not return a partially normalized candidate.

**Tests first**

- [x] Test NFC, CRLF and CR conversion, tab conversion, edge trimming, internal whitespace preservation, and line-break preservation.
- [x] Test optional empty omission versus required empty rejection and verify missingOptionalPaths ordering is deterministic.
- [x] Test supplied IDs remain opaque and exact; allocated IDs are stable under a deterministic allocator; candidate array order remains unchanged.
- [x] Test label-only and opaque-reference resources, safe HTTPS URLs, and rejection of non-HTTPS, credential-bearing, control-containing, malformed, and overlong URLs.
- [x] Test each structural requirement and each configured count or text bound at the exact boundary and one past the boundary.
- [x] Test unknown fields and every forbidden accepted-state field at the root and nested levels.
- [x] Test duplicate identifiers, invalid relationships, unsafe control content, malformed non-object values, and atomic rejection.
- [x] Run the focused tests before implementation and record the expected failures; implement normalization and validation; run pnpm run typecheck and pnpm run test.
- [x] Commit as feat: validate canonical plan content.

## Task 4: Model active plans, accepted revisions, replacement, and revision concurrency

**Files**

- Create packages/domain/src/revisions.ts.
- Create packages/domain/src/plan.ts.
- Create packages/domain/test/plan.test.ts.
- Create packages/domain/test/revisions.test.ts.
- Update packages/domain/src/index.ts.

**Commands and functions**

- [x] Define CreatePlanCommand with ownerId, candidate content, allocator, and acceptedAt.
- [x] Define ReplacePlanCommand with the existing plan, ownerId, expectedRevisionId, candidate content, allocator, and acceptedAt.
- [x] Implement createPlan(command): DomainResult<PlanAggregate>.
- [x] Implement replacePlan(command): DomainResult<PlanAggregate>.

**Rules**

- [x] On successful creation, allocate a PlanId and RevisionId, create lifecycle active, set revision number to 1, store the complete normalized snapshot as the current accepted revision, and create no confirmed progress records.
- [x] If the first candidate fails validation, return failure with no aggregate and no accepted plan.
- [x] On replacement, require the owner and active lifecycle, require expectedRevisionId to equal the current accepted revision, validate and normalize the complete replacement before constructing the result, and increment the revision number only after successful acceptance.
- [x] Treat replacement as full snapshot replacement. Preserve the PlanId and logical progress for stable item IDs; assign not_started version 0 to newly introduced item IDs; do not infer identity from matching titles or positions.
- [x] Keep historical progress records for omitted items without including omitted items in the current accepted snapshot or current dashboard summary. If a stable item ID returns in a later revision, its prior confirmed progress is available again.
- [x] On validation failure, stale revision, owner failure, deleted-plan access, or any other rejected replacement, return failure and leave the prior accepted aggregate unchanged.
- [x] Do not expose a pending candidate as accepted state. Candidate operation status belongs to a later application operation model.

**Tests first**

- [x] Test creation and replacement produce stable plan identity, monotonically increasing revision numbers, opaque revision IDs, and exact canonical order.
- [x] Test full snapshot replacement with stable, new, omitted, and returning item IDs and verify progress preservation semantics.
- [x] Test stale expectedRevisionId, absent expectedRevisionId, invalid owner, deleted lifecycle, and invalid candidate behavior. Assert the original aggregate is structurally unchanged after each failure.
- [x] Test a failed candidate never creates a current revision and cannot partially replace nested content.
- [x] Run focused tests before implementation, then pnpm run typecheck and pnpm run test.
- [x] Commit as feat: model accepted plan revisions.

## Task 5: Enforce learner-confirmed progress transitions and concurrency

**Files**

- Create packages/domain/src/progress.ts.
- Create packages/domain/test/progress.test.ts.
- Update packages/domain/src/plan.ts and packages/domain/src/index.ts.

**Commands and functions**

- [x] Define LearnerAction as start_item, complete_item, or undo_completion.
- [x] Define ProgressCommand with plan, ownerId, expectedRevisionId, itemId, expectedProgressVersion, action, and confirmedAt.
- [x] Implement effectiveProgress(plan, itemId): LearnerProgressRecord, returning not_started and version 0 when no confirmed record exists.
- [x] Implement applyProgressAction(command): DomainResult<PlanAggregate>.

**Rules**

- [x] Permit start_item only from not_started to in_progress.
- [x] Permit complete_item from not_started or in_progress to completed_by_learner.
- [x] Permit undo_completion only from completed_by_learner, returning to lastNonCompleteState when it is in_progress or to not_started by default.
- [x] Increment progressVersion on every accepted transition and set lastConfirmedAt to the command timestamp. Preserve lastNonCompleteState needed for undo.
- [x] Require the current active revision and exact owner. Require expectedRevisionId to match the current accepted revision and expectedProgressVersion to match the current item record.
- [x] Reject stale progress and stale revisions without changing the plan. Reject invalid transitions without changing the plan.
- [x] Keep confirmed progress separate from operation state. No pending, unvalidated, externally supplied, or failed action can alter the confirmed record.
- [x] Reject actions for unknown or omitted current item IDs, deleted plans, unavailable owners, and malformed timestamps. Timestamps record confirmation time and do not replace canonical array order or introduce an unstated event-ordering rule.

**Tests first**

- [x] Test the exact transition matrix, including the undo path from completed_by_learner to in_progress and to not_started.
- [x] Test version and timestamp updates, absence-as-not_started behavior, and preservation of lastNonCompleteState.
- [x] Test stale revision, stale progress version, invalid transition, unknown item, omitted item, deleted plan, and wrong-owner failures leave confirmed state unchanged.
- [x] Test a simulated pending or retryable application outcome does not alter the domain aggregate.
- [x] Run focused tests before implementation, then pnpm run typecheck and pnpm run test.
- [x] Commit as feat: enforce learner progress transitions.

## Task 6: Enforce owner-scoped deletion, deletion conflicts, and retention deadlines

**Files**

- Create packages/domain/src/deletion.ts.
- Create packages/domain/src/retention.ts.
- Create packages/domain/test/deletion.test.ts.
- Create packages/domain/test/retention.test.ts.
- Update packages/domain/src/plan.ts and packages/domain/src/index.ts.

**Commands and functions**

- [x] Define DeletePlanCommand with plan, ownerId, expectedRevisionId, deletedAt, and optional deletionOperationId.
- [x] Implement deletePlan(command): DomainResult<PlanAggregate>.
- [x] Define retention constants and RetentionDeadlines.
- [x] Implement retentionDeadlines(requestedAt, accountDeletedAt?) as a pure calculation that represents account lifetime explicitly and does not invent an account-deletion expiry while the account remains active.

**Rules**

- [x] Permit only active-to-deleted deletion for the exact owner and current expected revision.
- [x] On success, make the plan immediately inaccessible, remove its current readable revision from the aggregate view, retain a minimal tombstone sufficient to reject resurrection, and preserve the terminal revision reference only as needed for safe reconciliation and audit.
- [x] Map wrong-owner outcomes to owner_unavailable or another explicitly non-disclosing result. Never reveal whether a plan exists, is active, or was deleted to an unauthorized actor.
- [x] Map revision or deletion concurrency failures to deletion_conflict with fresh-read guidance. Do not map deletion conflicts to content-operation retryable failures.
- [x] Leave the active aggregate unchanged for failed deletion. Do not permit delayed or retried replacement, progress, or deletion requests to resurrect the deleted PlanId.
- [x] Keep idempotency-marker storage and replay reconciliation outside the pure aggregate, while exposing the conflict categories and terminal facts the application layer needs to apply Phase 2 lease and fencing rules.
- [x] Encode primary purge within 24 hours of deletion, full operation and replay detail expiry after 24 hours, mutation markers during account lifetime plus 35 days after deletion, redacted telemetry for 30 days, minimal security and ownership audit metadata for 90 days, and backup expiry or scrubbing within 35 days.
- [x] Make retention calculations distinguish account deletion from plan deletion and do not claim that domain constants themselves perform a purge.

**Tests first**

- [x] Test successful deletion, immediate read unavailability, tombstone behavior, repeated deletion behavior, and no-resurrection behavior.
- [x] Test wrong owner as non-disclosing, stale expected revision as deletion_conflict, deleted-plan operations, and unchanged aggregate after every failed deletion.
- [x] Test retention deadlines at exact boundaries and with an account that remains active, including the 24-hour primary-purge deadline and 35-day account-deletion marker and backup deadlines.
- [x] Run focused tests before implementation, then pnpm run typecheck and pnpm run test.
- [x] Commit as feat: enforce plan deletion and retention rules.

## Task 7: Publish deterministic contract fixtures and dashboard snapshots

**Files**

- Create packages/domain/src/fixtures.ts.
- Create packages/domain/src/snapshots.ts.
- Create packages/domain/test/fixtures.test.ts.
- Create packages/domain/test/snapshots.test.ts.
- Update packages/domain/src/index.ts.

**Factories and view boundary**

- [x] Export acceptedCompleteFixture.
- [x] Export acceptedPartialFixture.
- [x] Export acceptedNoProgressFixture.
- [x] Export revisionPreservesProgressFixture.
- [x] Export staleRevisionConflictFixture.
- [x] Export progressCompletionPendingFixture.
- [x] Export progressConflictFixture.
- [x] Export deletionConflictFixture.
- [x] Export deletedPlanFixture.
- [x] Export unauthorizedPlanFixture.
- [x] Define AcceptedPlanSnapshot with planId, revisionId, revisionNumber, acceptedAt, the complete accepted CanonicalPlanContent, current-item confirmed progress, and deterministic current progress counts or next-item summary.
- [x] Implement readOwnedAcceptedSnapshot(plan, ownerId): DomainResult<AcceptedPlanSnapshot>.
- [x] Keep snapshot types framework-neutral and omit JSX, CSS tokens, router URLs, provider payloads, access tokens, raw identity claims, and operation-internal data.
- [x] Represent pending, conflict, unavailable, and deletion states as explicit fixture/application outcomes without replacing the last confirmed progress state with operation state.
- [x] Make every fixture deterministic: fixed opaque IDs, fixed timestamps, fixed array order, fixed revision/progress versions, and no current-time or random-value calls.

**Tests**

- [x] Assert every named factory returns the documented scenario and can be serialized deterministically.
- [x] Assert complete, partial, and no-progress fixtures cover the Phase 3 dashboard handoff fields without choosing a UI framework.
- [x] Assert revision-preservation, stale-revision, progress-conflict, deletion-conflict, deleted, and unauthorized fixtures expose the correct safe outcome and last accepted state semantics.
- [x] Assert unauthorized snapshots are non-disclosing and do not reveal plan existence or accepted content.
- [x] Assert pending progress fixtures retain exact confirmed progress and put operation status in a separate result or action view.
- [x] Run focused tests before implementation, then pnpm run typecheck and pnpm run test.
- [x] Commit as test: add deterministic domain fixtures.

## Task 8: Close and document the public package boundary

**Files**

- Update packages/domain/src/index.ts.
- Create packages/domain/test/public-api.test.ts.
- Create packages/domain/README.md.

**Steps**

- [x] Export only the canonical domain types, command interfaces, limits, retention constants, result and error types, normalization and validation functions, plan/revision/progress/deletion transitions, snapshots, and deterministic fixtures required by later phases.
- [x] Keep constructors and internal helpers private unless exposing them is necessary for a stable contract test.
- [x] Add a public API test that imports from the package entry point, creates or loads a deterministic fixture, reads an owner-scoped snapshot, completes an item, and verifies the resulting confirmed progress.
- [x] Add a public API test that proves a raw actor ID cannot substitute for the typed InternalOwnerId without an explicit identity-boundary conversion owned by a later application layer.
- [x] Document that packages/domain is pure and framework-neutral; describe accepted candidate, aggregate transition, snapshot, error, and retention boundaries.
- [x] Run a forbidden-dependency scan with rg -n against packages/domain for react, vite, fastify, mcp, postgres, orm, oauth, oidc, bearer, and fetch(. Expected result: no runtime source dependency matches; explanatory boundary text in documentation may mention excluded technologies.
- [x] Run pnpm run verify and inspect generated declaration files for accidental UI, database, or provider types.
- [x] Commit as docs: publish domain package boundary.

## Task 9: Verify the specification and update Phase 4 status only after implementation evidence

**Files**

- Update docs/superpowers/specs/2026-08-30-openlearn-phase-4-learning-plan-domain-model-design.md.
- Update docs/phases/phase-04-learning-plan-domain-model.md.
- Update docs/ROADMAP.md only if the phase status and next phase are now justified.
- Update docs/README.md only if its current-status links or wording are stale.
- Update README.md only if its project-status wording needs to reflect the completed domain artifact without implying a running application.

**Steps**

- [x] Run pnpm install --frozen-lockfile.
- [x] Run pnpm run verify, which must execute typecheck, tests, and build.
- [x] Run git diff --check and a marker scan for TODO, TBD, FIXME, and unresolved placeholder language in changed files.
- [x] Review the final domain API and tests against ADR 0003 for persistence and accepted-state boundaries, ADR 0005 for canonical issuer and subject ownership mapping, ADR 0006 for MCP lifecycle and trust-boundary guarantees, the completed Phase 3 UX specification, the product brief, and the Phase 4 specification.
- [x] Confirm all Phase 4 deliverables are evidenced: glossary, entities and relationships, IDs and ordering, content requirements, normalization and validation, malformed and stale behavior, lifecycle and accepted state, revision CAS and replacement, last-accepted preservation, confirmed progress, actions and transitions, ownership, dashboard handoff, errors, deletion and retention, fixtures, boundaries, and scoped open questions.
- [x] Change the Phase 4 specification status from Draft for review to Accepted only when implementation and review evidence satisfy its checklist. Add an implementation note naming @openlearn/domain and the deterministic fixtures.
- [x] Mark docs/phases/phase-04-learning-plan-domain-model.md Complete and link the accepted specification only after all exit criteria pass. Set the next phase to Phase 5 only if no Phase 4 requirement remains unresolved.
- [x] Update ROADMAP.md and index documentation only with evidence-backed status; do not describe MCP, persistence, dashboard, or UI implementation as complete.
- [x] Commit as feat: complete phase 4 learning plan domain.

## Task 10: Perform final branch review and push

**Files and commands**

- [ ] Review git diff main...HEAD and git diff --stat. Confirm only Phase 4 domain implementation, tests, fixtures, package setup, and justified status documentation changed.
- [ ] Confirm no Phase 5 or Phase 6 implementation, database schema, ORM integration, MCP SDK integration, frontend framework, provider payload adapter, chat surface, prompt interpretation, curriculum generator, tutor, model host, or agent orchestrator was added.
- [ ] Rerun pnpm install --frozen-lockfile, pnpm run verify, git diff --check, and the forbidden-dependency scan. Record command output and any environmental limitation.
- [ ] Run git worktree list and git branch --show-current. Confirm the work is on the primary checkout at C:\github-projects\OpenLearn and the branch is phase-4-learning-plan-domain-model.
- [ ] Confirm git status is clean and the final commit is the one containing the complete Phase 4 artifact.
- [ ] Push with git push -u origin phase-4-learning-plan-domain-model.
- [ ] Verify git ls-remote origin refs/heads/phase-4-learning-plan-domain-model equals the local HEAD.
- [ ] Report the commit, pushed branch, validation commands actually run, and any remaining Phase 4 questions. Do not claim Phase 4 complete if any exit criterion or required check is unresolved.

## Execution Checkpoints

- Tasks 1 through 3 establish and prove the candidate contract before aggregate behavior exists.
- Tasks 4 through 6 implement accepted state, revision concurrency, learner-confirmed progress, deletion, and retention as separate domain axes.
- Tasks 7 and 8 make the package consumable by later UI and MCP work without coupling those layers into the domain.
- Task 9 is the status gate: documentation status remains Planned until all implementation and verification evidence exists.
- Task 10 is the integration gate: commit and push happen only after a clean review and successful relevant checks.

## Deferred Questions

The following remain outside Phase 4 and must not block this plan unless a later implementation requirement makes one necessary:

- Exact serialized wire format and versioning envelope for remote MCP calls.
- Exact MCP tool names, schemas, authentication middleware, replay store, lease store, and operation lifecycle implementation.
- Database tables, indexes, transactions, purge jobs, backup mechanism, and durable mutation-reference reconciler.
- Dashboard OIDC adapter, session implementation, UI framework, URL routing, accessible component implementation, and packages/ui view-model prop names.
- Provider-specific identifier mapping and any external AI client behavior.
- Legal or policy-specific retention overrides beyond the normative Phase 2 durations.
- Future plan collaboration, sharing, branching, automated progress, reminders, scheduling, resource fetching, or model-generated plan features.
