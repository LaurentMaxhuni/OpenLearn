# ADR-0003: Persistence and state boundary

**Status:** Accepted

## Context

The returning-user journey requires plan state and learner progress to survive refreshes, sessions, and service restarts. MCP connections and external requests also have lifecycle state, but that state is temporary, sensitive, and not part of the learner's plan. Treating both categories alike would either lose learner progress or retain more integration data than the product needs.

## Decision

Use PostgreSQL 18 as OpenLearn's durable store. Access it only through persistence adapters that implement ports owned by the application layer. Domain and application packages may depend on repository interfaces and transaction abstractions, but they must not depend on a PostgreSQL client, SQL row shape, or migration tool.

Durable domain state includes:

- the internal learner or workspace ownership reference;
- accepted plan identity and versioned plan revisions;
- plan content that passed the domain validation boundary;
- learner progress and the state transitions that the product permits; and
- the minimum audit metadata needed to explain ownership, revision, and progress changes.

Bounded or lifecycle-scoped integration state includes:

- MCP session metadata when a transport requires it;
- request correlation and lifecycle status;
- operation deadline, recovery lease, and fencing version;
- idempotency or deduplication records with an explicit expiry policy;
- retry, timeout, and cancellation metadata; and
- short-lived authorization or capability-discovery caches.

Bounded integration records may be stored in PostgreSQL when cross-instance consistency requires it, but they are not learner-domain state and must have retention limits. Process memory must never be the only copy of data needed after a restart or by another service instance.

The system does not persist raw AI conversations, bearer tokens, authorization codes, or full request payloads in observability records by default. Plan content is stored only after validation in its canonical form. The first implementation uses these retention assumptions:

- Accepted plan revisions and learner progress remain available while the account and plan exist; the minimum product has no inactivity expiry.
- A learner-initiated plan deletion immediately hides the plan and rejects further reads or mutations. Primary plan content, revisions, and progress are purged within 24 hours. A minimal deletion tombstone may remain only to prevent stale retries or backup restores from resurrecting the plan.
- Account deletion applies the same access revocation and purge behavior to every owned plan. Backups expire or are scrubbed within 35 days, and restore procedures replay deletion tombstones before serving data.
- Pending, rejected, and expired request payloads are not retained as learner content. Full lifecycle records and replay response details expire 24 hours after terminal completion or expiration. Every mutation also creates a minimal deduplication marker containing an owner/capability/key scope digest, request-fingerprint digest, terminal outcome, operation ID, and resource reference; it contains no request payload or bearer token and remains while the owning account exists. After account deletion, the marker remains with the deletion tombstone for 35 days so stale retries are rejected rather than treated as new mutations. Discovery and authorization caches have a maximum 24-hour lifetime and contain no bearer tokens.
- Redacted operational telemetry is retained for 30 days. Minimal security and ownership audit metadata is retained for 90 days. Neither contains raw prompts, access tokens, authorization codes, or complete plan content by default.

These are product and architecture assumptions, not a claim that the current documentation-only repository enforces them. Phase 9 verifies the final implementation against the privacy review and applicable obligations without weakening the learner-control invariants.

Learners can delete a plan from the dashboard. Deletion is immediately effective for reads and writes across dashboard and MCP paths; an old operation, idempotency key, or restored backup cannot recreate it. Creating a new plan after deletion requires a new authorized operation. There are no anonymous production share links.

Domain writes use transactions. Plan revisions and learner progress use explicit version or optimistic-concurrency checks, and external mutations require an idempotency key or equivalent request identity so retries cannot silently overwrite confirmed state. Every accepted mutation records its operation ID, owner/capability scope, request-fingerprint digest, and resource or revision reference in a durable mutation ledger. The domain mutation, terminal operation outcome, and minimal deduplication marker are committed in one PostgreSQL transaction, so a successful domain commit cannot lack a terminal outcome under the normal path.

The initial `in_progress` reservation records a deadline, a recovery lease, and a fencing version. If a service instance disappears, a same-key request or bounded service maintenance sweep claims an expired lease with compare-and-set, increments the fencing version, and enters reconciliation. Reconciliation checks the mutation ledger: a matching committed entry becomes `succeeded`; no matching entry becomes `expired` with no domain write; a mismatched entry fails closed as `conflict`. The final write is accepted only for the current fencing version, so an old instance cannot commit after takeover. Retryable expiration reopens the same logical operation with the same key while the full operation record is retained; it never creates an untracked second operation.

Schema migrations are versioned, reviewable, and run separately from application startup when the deployment environment requires it.

The exact tables, fields, indexes, and plan serialization are Phase 4 work. This decision establishes ownership and storage semantics, not the canonical domain schema.

## Alternatives considered

### Document database

A document store could accept evolving AI-shaped payloads quickly, but it would make progress transitions, ownership, revisions, and concurrency rules harder to review as separate invariants. PostgreSQL keeps the durable core explicit while still allowing versioned content to carry structured data where the Phase 4 contract requires it.

### Browser-only storage

Browser storage would reduce service complexity but cannot support reliable returning-user access across devices or a trusted MCP write boundary. It also makes learner ownership and data deletion less controllable.

### Provider-managed application database

A managed application platform could remove database operations, but it would couple domain state to the platform's identity, query, and deployment model before OpenLearn has validated those choices.

## Consequences

Positive consequences:

- Learner progress and accepted revisions have a durable source of truth.
- Application services can test domain transitions without a live MCP client.
- Retry and concurrency behavior can be made explicit and observable.
- Integration metadata can be retained narrowly and expired independently of learner data.

Costs and constraints:

- The first implementation needs migrations, transaction handling, and local PostgreSQL setup.
- The domain model must define version, deletion, retention, and progress semantics before schema work is complete.
- Horizontal service scaling requires externalized bounded integration state for any stateful transport behavior.

## Revisit conditions

Revisit this decision if the domain becomes genuinely event-sourced, if measured workloads require a separate analytical store, or if the Phase 4 contract shows that a different durable representation can preserve ownership, revision, progress, and deletion invariants more clearly.

## References

- [PostgreSQL supported versions and versioning policy](https://www.postgresql.org/support/versioning/)
- [PostgreSQL current documentation](https://www.postgresql.org/docs/current/)
