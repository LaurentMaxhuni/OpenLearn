# ADR-0006: MCP connection and trust boundary

**Status:** Accepted

## Context

MCP is the external capability surface through which an AI client can ask OpenLearn to create or update a dashboard view and read the resulting state. The transport can be local or remote, and the payload can be incomplete, malicious, duplicated, or stale. OpenLearn must expose useful operations without allowing external content to become executable UI or bypass learner ownership.

## Decision

Use the official MCP TypeScript SDK as a protocol adapter. Support the two standard deployment modes:

- **stdio for local integrations:** the client launches the MCP service as a subprocess and communicates over standard streams; the process writes only protocol messages to standard output and sends diagnostics to standard error.
- **Streamable HTTP for remote integrations:** the service exposes one MCP endpoint over HTTPS. The endpoint supports the transport's request and optional stream behavior, validates the `Origin` header, requires authorization, and is stateless by default so service instances do not depend on process-local session memory.

Do not add the deprecated HTTP+SSE transport to the first implementation unless compatibility evidence requires it. Do not invent a custom transport. If stateful Streamable HTTP features become necessary, session state must be externalized and bounded before the service is scaled across instances.

Keep the MCP adapter as a thin translation layer. Its capability groups are:

- plan-view creation or revision from plan-shaped input;
- retrieval of an authorized plan view and its current state; and
- learner-authorized progress actions that the domain contract permits.

The exact tool names, schemas, result envelopes, and compatibility versions belong to Phases 4 and 6. The adapter must call application services rather than repositories or SQL. The application service performs actor checks, request-size limits, input validation, state transitions, transaction handling, idempotency, and structured error mapping. The lifecycle and recovery invariants below are fixed architecture behavior; later phases may specify field names and protocol wiring but may not remove them.

The request lifecycle is:

1. establish transport and protocol version;
2. authenticate the caller when the transport is remote or otherwise requires credentials;
3. validate origin, capability permission, request size, correlation metadata, and basic shape;
4. call the application command or query with an internal actor context;
5. commit only accepted domain state and return stable identifiers, current status, a dashboard handoff when a plan view exists, and safe errors; and
6. emit redacted lifecycle telemetry with request and outcome identifiers.

Every mutation has an opaque operation ID and a required idempotency key. Its bounded state machine is:

```text
received -> in_progress -> succeeded
                      |-> rejected
                      |-> failed_retryable
                      |-> cancelled
                      |-> expired
                      |-> conflict
                      `-> reconciling -> succeeded
                                      `-> expired
```

`rejected` means validation or authorization prevented a domain write. `failed_retryable` means the operation did not commit and may be retried with the same idempotency key. `expired` means the bounded deadline or recovery lease elapsed before a domain commit was found. `cancelled` means cancellation was accepted before commit. `conflict` means the request was stale or reused an idempotency key with a different request fingerprint. `reconciling` is a bounded non-terminal recovery state entered only after an `in_progress` lease expires. `in_progress` and `reconciling` are non-terminal; every reconciliation must resolve to a terminal outcome or remain eligible for a later bounded recovery attempt.

Every `in_progress` operation records `started_at`, `deadline_at`, `lease_expires_at`, and a fencing version. The first synchronous implementation targets a 30-second request deadline and sets the recovery lease to expire after a bounded 10-second grace period. A same-key request before lease expiry returns the existing operation and a retry hint; it never starts a second mutation. A same-key request after lease expiry, or a bounded recovery sweep at service startup and during normal service operation, atomically claims the lease, increments the fencing version, and enters `reconciling`. The sweep is lightweight maintenance, not unbounded application work, and ensures an abandoned row is not considered active indefinitely.

An accepted domain mutation, its operation outcome, and its minimal idempotency marker are committed in one PostgreSQL transaction. The domain mutation or mutation ledger records the operation ID, owner/capability scope, request-fingerprint digest, and resource or revision reference. A worker may finalize that transaction only while its fencing version is current. Therefore a crash cannot leave a committed mutation without its terminal outcome under the normal path, and an old worker cannot commit after a later instance takes over.

Reconciliation is deterministic and fail-closed:

1. Lock the operation record and return an existing terminal outcome if one is present.
2. If the lease is still active, leave the operation `in_progress` and return its current status.
3. If the lease has expired, claim `reconciling` with a compare-and-set on the lease and fencing version.
4. Look up the durable mutation or mutation-ledger entry by operation ID and verify the owner, capability, and request-fingerprint digest.
5. If a matching committed mutation exists, record `succeeded` with its resource/reference outcome. If no matching mutation exists, record `expired` with no domain write. A mismatched entry is a `conflict` and never becomes a successful result.

The same idempotency key remains the caller's recovery handle throughout this process. An `expired` or `failed_retryable` operation may be reopened as the same logical operation with the same key while its full operation record is retained; it does not receive a new operation ID or bypass the deduplication marker. Once the full record has expired, the long-lived marker returns the terminal non-creation outcome rather than accepting that key as new.

All external content is data, not instructions to the service. The adapter and domain boundary reject arbitrary code, component names outside the allowlisted product surface, HTML or JavaScript intended for execution, unbounded content, and attempts to select a different actor. Dashboard components render validated state from the component registry; they never execute model-supplied markup.

The service uses the following lifecycle behavior:

- **Discovery:** after MCP initialization, standard capability discovery exposes only operations allowed for the authenticated actor and the advertised contract version. Discovery returns no learner data. Exact tool names and metadata fields are Phase 6 work.
- **Timeout:** the first synchronous implementation uses a bounded request deadline with a 30-second target and a recovery lease that expires after a bounded 10-second grace period. If the deadline occurs before commit, the transaction rolls back and the operation becomes `expired` or `failed_retryable`. If the response is lost after commit, the same idempotency key returns the committed result rather than creating a second mutation. If the operation is still `in_progress` after lease expiry, the later request or recovery sweep reconciles it before returning a terminal result.
- **Cancellation:** explicit cancellation is honored while the operation is `in_progress` and before the domain transaction commits. After commit, cancellation cannot roll back learner state and returns the committed outcome. A transport disconnect is only a best-effort cancellation signal.
- **Retries:** reads may be retried. Mutations may be retried only with the same owner, capability, idempotency key, and request fingerprint. A matching key returns the existing `in_progress`, `reconciling`, or terminal result while the full operation record exists; a changed fingerprint is `conflict`; a mutation without an idempotency key is rejected. A retryable failure may be retried with the same key only while its full operation record is available, and an abandoned operation must be reconciled before that retry is accepted.
- **Duplicate handling:** OpenLearn does not guess that two different keys contain the same intent. The idempotency key is the duplicate boundary. Full lifecycle and response details expire 24 hours after terminal completion or expiration, but a minimal key-to-outcome marker remains while the owning account exists and for 35 days after account deletion. The marker stores only scope and request-fingerprint digests, terminal outcome, operation ID, and resource reference; it replays a committed result or returns a terminal non-creation outcome and never treats a previously seen key as a fresh mutation.
- **State preservation:** `rejected`, `failed_retryable`, `cancelled`, `expired`, and `conflict` never replace the last accepted plan. A stale revision requires a fresh read rather than an automatic overwrite.

A failed request cannot erase the last accepted plan. A revision cannot silently overwrite learner-confirmed progress; it must pass the version and state rules defined by the domain contract. Observability records capability, actor class, correlation ID, operation ID, lifecycle transition, latency, validation outcome, and failure category while omitting access tokens, authorization codes, raw prompts, and full plan content by default.

## Alternatives considered

### Direct HTTP API only

A private JSON API could serve the dashboard, but it would not provide the standardized discovery and invocation surface required by the external AI-client workflow. The learner API may coexist, but it does not replace MCP.

### MCP embedded in the dashboard application

Embedding the adapter in the browser application or a co-hosted dashboard runtime would couple protocol lifecycle and UI deployment. The separate service keeps remote trust and scaling concerns out of the component package.

### Custom or legacy transport

A custom or legacy transport would increase interoperability and maintenance cost. stdio and Streamable HTTP cover the local and remote modes needed by the product baseline.

## Consequences

Positive consequences:

- Local and remote AI clients have a documented connection model.
- MCP requests cannot bypass the application and domain boundaries.
- Stateless remote handling fits independent container instances.
- Structured results and redacted telemetry support learner recovery and maintainer support.

Costs and constraints:

- The service must implement origin validation, authorization, size limits, cancellation, and safe error mapping.
- The service must persist operation leases, fencing versions, and mutation references, and must reconcile expired operations on same-key access and bounded maintenance sweeps.
- Phase 6 must test the SDK adapter against representative clients and protocol versions.
- The domain contract must define idempotency, revision, progress, and partial-result semantics before live tools are enabled.

## Revisit conditions

Revisit this decision if a required client cannot support Streamable HTTP or stdio, if measured workflows need stateful resumability, or if a new MCP transport becomes an accepted standard with a materially better fit. Any compatibility addition must preserve the same application and trust boundaries.

## References

- [MCP transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
- [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [MCP TypeScript SDK server guidance](https://ts.sdk.modelcontextprotocol.io/server)
