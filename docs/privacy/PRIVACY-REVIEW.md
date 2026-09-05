# OpenLearn Phase 9 privacy and retention review

**Review date:** 2026-09-05
**Scope:** Current Phase 7 progress and Phase 8 personalization slices, application telemetry contracts, and browser-local adapters.
**Status:** Reviewed for the current implementation; deployment-specific legal and operational review remains required.

## Allowed data

- Internal owner and plan references needed to scope accepted state.
- Canonical accepted plan content and learner-confirmed progress while the account and plan exist.
- Consent state/version and timestamps for one owner and one plan.
- Bounded difficulty, pace, and relevance feedback, lifecycle status, proposal basis categories, and opaque revision handoffs.
- Minimal operation identifiers, capability category, actor class, transition, duration, validation category, and request/fingerprint digests where the application contract requires them.

## Prohibited data

The current contracts and browser stores must not retain or emit raw prompts, conversation history, embeddings, sensitive traits, cross-plan profiles, credentials, bearer tokens, authorization codes, complete request/response payloads, unvalidated plan candidates, or free-text personalization notes.

## Learner controls

- Personalization starts disabled for each owner/plan pair.
- Enablement is explicit and versioned; pause stops evaluation and new feedback capture without altering progress or plan content.
- Revocation withdraws unresolved proposals, removes feedback from future evaluation, and starts a new consent epoch if re-enabled.
- Feedback can be corrected as a linked record or logically deleted.
- Accepting a suggestion records learner intent only; it never writes accepted plan content or learner-confirmed progress.
- Plan deletion immediately removes readable state and prevents stale retries from resurrecting it.

## Retention baseline

The Phase 2 baseline remains authoritative:

| Category | Window | Current evidence |
| --- | --- | --- |
| Primary plan, revision, progress, and personalization purge | Within 24 hours of deletion | `packages/domain/src/retention.ts`, deletion/personalization transitions |
| Full operation details and replay response details | 24 hours after terminal/expired state | `packages/domain/src/retention.ts` |
| Redacted operational telemetry | 30 days | `packages/domain/src/retention.ts`, `TelemetryEvent` contract |
| Minimal security/ownership audit metadata | 90 days | `packages/domain/src/retention.ts` |
| Backups and deletion tombstone protection after account deletion | 35 days | `packages/domain/src/retention.ts`, retention tests |

Retention functions calculate deadlines; they do not claim to delete data. A production adapter must execute purge jobs, replay deletion tombstones on restore, and prove that logs and backups follow these windows.

## Browser-local limitation

The static dashboard stores minimal records in versioned `localStorage` keys for deterministic preview behavior. Hydration rejects malformed, foreign, and cross-plan records, but browser storage remains user-controlled and is not suitable as the hosted source of truth. Production use requires an authenticated server adapter with the same domain/application transitions and retention behavior.

## Review conclusion

The current implementation meets the documented minimization and learner-control contract for local deterministic behavior. Automated Phase 9 tests also verify that lifecycle telemetry is bounded to operational metadata and excludes raw mutation values. It is not a legal determination, a data-protection impact assessment, or evidence that a deployed service satisfies a jurisdiction-specific obligation.
