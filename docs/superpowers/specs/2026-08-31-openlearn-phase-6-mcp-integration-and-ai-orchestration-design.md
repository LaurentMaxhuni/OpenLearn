# OpenLearn Phase 6: MCP integration and AI orchestration boundary specification

**Status:** Draft for review

**Phase:** 6 - MCP integration and AI orchestration

**Purpose:** Define the first implementation slice for receiving untrusted plan-shaped input from an external AI client, authorizing the request, applying the Phase 4 domain contract, and returning a safe, observable MCP result.

**Scope:** This specification covers the protocol-neutral application boundary, the official MCP TypeScript SDK adapter, the Fastify service composition boundary, exact first-release capability contracts, and deterministic lifecycle tests. It does not add prompt interpretation, model hosting, an identity-provider vendor, a PostgreSQL schema, or a production persistence adapter.

The Phase 6 status remains `Planned` until the full phase exit criteria are satisfied. This document describes the approved first increment and the invariants that later persistence and authentication adapters must preserve.

## 1. Boundary and normative language

OpenLearn is a provider-neutral application and dashboard surface. An external AI client owns conversation, learner-intent interpretation, and generation or revision of plan-shaped content. OpenLearn owns authorization, request lifecycle, domain validation, accepted-state transitions, safe result mapping, and redacted operational signals.

The words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are normative.

The first increment uses these workspace boundaries:

```text
packages/application  actor context, capabilities, ports, use cases, lifecycle
packages/mcp          official MCP SDK registration and protocol translation
apps/service          Fastify composition, auth/transport adapters, service startup
packages/domain       canonical validation and accepted plan/progress transitions
packages/ui           presentation-only view models and components
```

Dependency direction is inward:

```text
MCP adapter  -> application ports/use cases -> domain
HTTP service -> application ports/use cases -> domain
auth adapter -> application actor context
dashboard   -> service API -> application use cases
```

`packages/application` MUST NOT import Fastify, the MCP SDK, PostgreSQL clients, ORM types, React, or an identity-provider SDK. `packages/mcp` MUST NOT access repositories or SQL directly. `apps/service` is the only runtime assembly point.

## 2. Approved implementation slice

### 2.1 Application boundary

Create `packages/application` with framework-neutral types and use cases for the three initial capability groups:

1. plan-view creation or full revision replacement;
2. authorized plan-view retrieval; and
3. learner-authorized progress actions already defined by the Phase 4 domain contract.

The application layer receives an internal `ActorContext`, not a bearer token, raw identity claims, an email address, a provider account ID, or a caller-selected owner ID. It checks capability scope before invoking domain behavior.

The layer exposes ports for plan state, operation lifecycle, mutation deduplication, clock, operation identity, and redacted telemetry. The first deterministic adapters are test-only. Production composition requires explicit implementations of these ports; the service MUST NOT silently fall back to process-local state for a deployed environment.

### 2.2 MCP adapter

Create `packages/mcp` using the official MCP TypeScript SDK. The adapter registers the exact tool names below, converts protocol inputs into application commands, and converts application results into structured MCP content. It contains no plan business rules and no persistence access.

The supported transport modes remain the Phase 2 decision:

- stdio for a client-launched local process; standard output contains protocol messages only and diagnostics go to standard error;
- Streamable HTTP for remote requests, with authorization and `Origin` validation performed before application work; and
- no legacy HTTP+SSE or custom transport in this increment.

### 2.3 Service composition

Create `apps/service` as a separately deployable Fastify application. It owns configuration, transport setup, the injected authentication resolver, application dependencies, MCP server construction, and liveness/readiness composition. It does not implement domain transitions in route handlers.

The service starts only when required boundary dependencies are supplied. Local tests may supply deterministic actors and in-memory ports. Missing authentication, operation, or plan-state dependencies are configuration failures, not anonymous-access fallbacks.

## 3. Actor context and capability authorization

The application boundary accepts this conceptual actor context:

```text
ActorContext {
  ownerId: InternalOwnerId
  scopes: ('plan:read' | 'plan:write' | 'progress:write')[]
  actorClass: 'dashboard_session' | 'remote_mcp' | 'local_stdio'
}
```

The `ownerId` is produced by an authentication adapter after it verifies the relevant credential and canonical issuer/subject mapping. The adapter may use raw authorization material internally, but raw tokens and provider claims MUST stop at that adapter. `actorClass` is bounded audit metadata and is not an ownership key.

Authorization rules:

- `plan:read` is required for plan-view retrieval;
- `plan:write` is required for creation and revision replacement;
- `progress:write` is required for learner progress actions;
- a caller cannot select an owner through a tool argument;
- missing, expired, wrong-issuer, audience-mismatched, or insufficiently scoped credentials fail before domain work; and
- authorization and ownership failures use a safe unavailable result that does not reveal whether a plan exists.

The first increment defines an authentication port and deterministic test resolver. It does not choose an OIDC/OAuth vendor or claim that hosted credentials are configured.

## 4. Exact MCP capability contract

The MCP adapter advertises only capability metadata after protocol initialization. Discovery contains the contract version and allowed operation metadata, never learner data, plan titles, resource URLs, or accepted content.

### 4.1 `openlearn.create_plan_view`

This tool handles both a new plan and a full replacement revision. The caller chooses replacement by supplying an existing `planId` and its `expectedRevisionId`; it never supplies an owner ID.

```text
Input {
  idempotencyKey: string
  candidate: unknown
  acceptedAt: Timestamp
  planId?: PlanId
  expectedRevisionId?: RevisionId
}
```

If `planId` is absent, the application calls the Phase 4 create transition. If `planId` is present, both `planId` and `expectedRevisionId` are required and the application calls the Phase 4 replacement transition. A replacement never silently overwrites a stale revision or confirmed progress.

### 4.2 `openlearn.get_plan_view`

```text
Input {
  planId: PlanId
}
```

The application resolves the plan through the owner-scoped state port and calls `readOwnedAcceptedSnapshot`. It returns only the authorized accepted snapshot and safe dashboard handoff information.

### 4.3 `openlearn.apply_progress_action`

```text
Input {
  planId: PlanId
  itemId: PlanItemId
  action: 'start_item' | 'complete_item' | 'undo_completion'
  expectedRevisionId: RevisionId
  expectedProgressVersion: number
  idempotencyKey: string
  confirmedAt: Timestamp
}
```

The application binds `planId` and `ownerId` from the authorized command context, checks the revision and progress versions, and calls `applyProgressAction`. A progress operation cannot change plan content or claim that an unconfirmed action is complete.

## 5. Result envelope and dashboard handoff

Every tool returns a structured, provider-neutral result with this conceptual shape:

```text
Result {
  contractVersion: 'openlearn.phase6.v1'
  outcome: 'succeeded' | 'in_progress' | 'reconciling' | 'rejected'
          | 'failed_retryable' | 'cancelled' | 'expired' | 'conflict'
  operation: {
    operationId: string
    state: OperationState
  }
  plan?: {
    planId: PlanId
    revisionId: RevisionId
    revisionNumber: number
    dashboardUrl: string
  }
  snapshot?: AcceptedPlanSnapshot
  error?: {
    code: string
    message: string
    retryable: boolean
  }
}
```

Fields are omitted when they could disclose unauthorized state or unaccepted content. A failure never includes a raw request body, bearer token, authorization code, internal stack trace, or provider-specific claim. A plan handoff URL is built from a service-controlled dashboard origin and `/plans/{plan_id}`; the caller cannot provide the origin or a redirect destination.

The MCP adapter may include human-readable protocol content derived from the safe `message`, but it MUST also return the structured result for clients that need deterministic handling.

## 6. Operation lifecycle and duplicate behavior

Every mutation requires an idempotency key, receives an opaque operation ID, and carries a request fingerprint. The bounded state machine is:

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

The application coordinator MUST enforce these rules:

- target request deadline: 30 seconds;
- recovery lease grace period: 10 seconds after an in-progress lease expires;
- the same owner, capability, idempotency key, and request fingerprint returns the existing in-progress, reconciling, or terminal outcome;
- a changed request fingerprint for an existing key returns `conflict` and never starts a second mutation;
- a mutation without an idempotency key returns `rejected` before domain work;
- cancellation is honored before the domain transaction commits and cannot roll back a committed mutation;
- an expired in-progress lease may be claimed with compare-and-set and a fencing version, then reconciled against a durable mutation reference;
- a matching committed mutation resolves to `succeeded`, no matching mutation resolves to `expired`, and a mismatched reference resolves to `conflict`; and
- rejected, failed, cancelled, expired, and conflicted work preserves the last accepted plan.

The first increment tests these rules through ports and a fake clock. It does not pretend an in-memory operation record is durable. Full operation details have the Phase 2 retention target of 24 hours; minimal deduplication markers contain only bounded digests, outcome, operation ID, and resource reference and follow the account/deletion retention rules.

## 7. Domain conversion and trust handling

External candidates enter the application as `unknown`. The application:

1. checks actor capability and mutation identity;
2. chooses create or replacement based on the explicit plan/revision fields;
3. calls the Phase 4 domain transition, which normalizes and validates the candidate;
4. commits only an accepted domain aggregate through the plan-state port;
5. reads an owner-scoped accepted snapshot for the result; and
6. maps domain failures to safe application/MCP outcomes without returning unsafe raw details.

The application MUST NOT interpret prompts, execute instructions contained in plan content, fetch model-supplied URLs, render HTML or JavaScript, select UI components by external name, or accept a provider-specific payload as a trusted domain object. The dashboard remains the consumer of the accepted snapshot and its existing view-model mapping.

## 8. Observability and privacy

The telemetry port records bounded metadata:

- request/correlation ID;
- operation ID;
- capability group and actor class;
- lifecycle transition and latency bucket or duration;
- validation outcome and bounded failure category; and
- transport or compatibility result.

Telemetry MUST omit bearer tokens, authorization codes, raw prompts, full candidate payloads, complete plan content, resource credentials, and provider-specific claims by default. Logging errors MUST NOT turn an untrusted payload into a log-injection surface; values are structured and length-bounded.

## 9. Error and recovery mapping

The application owns the mapping from domain and integration outcomes to protocol and dashboard-safe states:

| Source outcome | Application/MCP outcome | Content allowed |
| --- | --- | --- |
| accepted domain write | `succeeded` | accepted plan reference and snapshot when authorized |
| malformed or unsafe candidate | `rejected` | bounded validation summary, no raw candidate |
| stale revision/progress | `conflict` | safe retry/fresh-read direction |
| unauthorized or wrong owner | `rejected`/unavailable | no plan reference or existence detail |
| provider/transport failure before commit | `failed_retryable` | operation ID and retry direction |
| explicit pre-commit cancellation | `cancelled` | last accepted state remains unchanged |
| deadline/recovery expiry without commit | `expired` | fresh retry direction, no fabricated plan |
| same-key active operation | `in_progress` or `reconciling` | operation status and bounded retry hint |

An uncertain mutation never produces a new plan or revision merely because the transport response was lost. A later same-key request or bounded recovery sweep resolves the original operation.

## 10. Test and acceptance contract

The first implementation increment is accepted when its tests prove:

- capability discovery contains no learner data and exposes only authorized operation metadata;
- missing scope, wrong owner, missing credentials, and invalid identity context fail before domain calls;
- accepted create and replacement candidates reach the Phase 4 domain transitions;
- malformed, unsafe, stale, deleted, and invalid candidates become safe rejected/conflict outcomes;
- successful results contain stable operation and plan/revision references plus a service-controlled dashboard handoff;
- unauthorized and deleted reads do not disclose plan existence;
- duplicate matching keys replay or return the existing operation, while changed fingerprints conflict;
- missing keys, cancellation, deadlines, lease recovery, fencing, and provider failures follow the lifecycle rules;
- progress actions preserve confirmed-state semantics and use revision/progress compare-and-set inputs;
- MCP tool handlers translate only the approved schemas and never expose credentials or raw external payloads;
- stdio keeps diagnostics off standard output and Streamable HTTP rejects invalid origin/auth context before application work; and
- application, MCP, and service packages keep the dependency direction described above.

The first increment does not mark Phase 6 complete. A later implementation step must provide durable persistence, configured authentication, representative protocol-client compatibility checks, and deployment-ready transport configuration before the phase exit criteria can be claimed.

## 11. Explicit non-goals and deferred decisions

- The external AI client remains responsible for chat, prompt interpretation, curriculum generation, and learner-facing conversation.
- No model/provider SDK, prompt template, agent loop, or automatic curriculum generator is added.
- No identity-provider vendor, OAuth/OIDC library, or production credential configuration is selected here.
- No PostgreSQL tables, migration tool, ORM, or production persistence adapter is added in this first increment; application ports must make that future adapter explicit.
- No Phase 7 learner activity UI, durable progress product behavior, reminders, scheduling, collaboration, or personalization is added.
- No anonymous production dashboard route or caller-supplied redirect is introduced.
- No legacy HTTP+SSE transport or custom MCP protocol is introduced.

## References

- [Phase 2: Architecture and technology decisions](../../phases/phase-02-architecture-decisions.md)
- [Phase 4: Learning-plan domain model](../../phases/phase-04-learning-plan-domain-model.md)
- [Phase 5: Application shell and static dashboard](../../phases/phase-05-application-shell-and-static-dashboard.md)
- [MCP connection and trust boundary ADR](../../architecture/decisions/0006-mcp-connection-and-trust-boundary.md)
- [Identity and authentication boundary ADR](../../architecture/decisions/0005-identity-and-authentication.md)
- [Persistence and state boundary ADR](../../architecture/decisions/0003-persistence-and-state-boundary.md)
