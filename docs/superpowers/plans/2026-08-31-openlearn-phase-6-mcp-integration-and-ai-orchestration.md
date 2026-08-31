# OpenLearn Phase 6 MCP integration and AI orchestration implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a tested, provider-neutral application and MCP boundary that accepts only validated learning-plan state and exposes safe request lifecycle results.

**Architecture:** Add a framework-neutral `@openlearn/application` package for actor authorization, capability use cases, lifecycle/idempotency coordination, and explicit state/telemetry ports. Add `@openlearn/mcp` as a thin official MCP TypeScript SDK adapter, and add `apps/service` as the Fastify runtime composition layer. Deterministic in-memory adapters exist only for tests; the service requires explicit state and authentication dependencies.

**Tech Stack:** pnpm workspace, strict TypeScript, Node.js 24 baseline, Fastify, the official `@modelcontextprotocol/sdk`, Zod schemas at the protocol boundary, Node's built-in `node:test`, and the existing `@openlearn/domain` package.

**Spec:** `docs/superpowers/specs/2026-08-31-openlearn-phase-6-mcp-integration-and-ai-orchestration-design.md`

## Global Constraints

- Treat every external candidate as `unknown` until `@openlearn/domain` accepts it.
- Keep dependency direction inward: MCP and HTTP adapters call application ports/use cases; application calls domain; neither domain nor application imports transport, database, React, or provider SDKs.
- Use the exact capability names `openlearn.create_plan_view`, `openlearn.get_plan_view`, and `openlearn.apply_progress_action`.
- Use the exact capability scopes `plan:read`, `plan:write`, and `progress:write`.
- Mutations require an idempotency key and follow `received`, `in_progress`, `reconciling`, `succeeded`, `rejected`, `failed_retryable`, `cancelled`, `expired`, and `conflict` semantics.
- Keep the request deadline at 30 seconds and the recovery lease grace period at 10 seconds.
- Never accept an owner ID, bearer token, raw identity claim, redirect origin, executable markup, or provider-specific account ID from a tool argument.
- Do not add a model SDK, prompt interpreter, chat surface, PostgreSQL schema, ORM, identity-provider vendor, or production persistence adapter in this increment.
- Standard output for stdio is reserved for MCP protocol messages; diagnostics use standard error.
- Remote Streamable HTTP validates origin and authorization before application work; legacy HTTP+SSE and custom transports are out of scope.

---

### Task 1: Scaffold the application, MCP, and service workspace units

**Files:**
- Create: `packages/application/package.json`, `packages/application/tsconfig.json`, `packages/application/tsconfig.build.json`
- Create: `packages/mcp/package.json`, `packages/mcp/tsconfig.json`, `packages/mcp/tsconfig.build.json`
- Create: `apps/service/package.json`, `apps/service/tsconfig.json`, `apps/service/tsconfig.test.json`, `apps/service/src/env.d.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- `@openlearn/application` is framework-neutral and depends only on `@openlearn/domain`.
- `@openlearn/mcp` depends on `@openlearn/application`, `@modelcontextprotocol/sdk`, and its schema dependency.
- `@openlearn/service` depends on `@openlearn/application`, `@openlearn/mcp`, Fastify, and the domain package only where startup fixtures require a domain allocator.

- [ ] **Step 1: Write the package manifest tests/checks first**

Add a repository test or package-boundary check that asserts the application package has no Fastify/MCP/database/auth/provider dependency and that the MCP package does not depend on Fastify or a database client.

```powershell
rg -n -i "fastify|modelcontextprotocol|postgres|orm|oauth|oidc|react|fetch\(" packages/application/src packages/application/package.json
```

Expected: no matches in application source or manifest.

- [ ] **Step 2: Run the new package checks and observe the expected missing-package failure**

Run `pnpm --filter @openlearn/application typecheck` and confirm the package is not yet present. Keep the failure attributable to the missing scaffold, not to a malformed assertion.

- [ ] **Step 3: Add manifests and compiler settings**

Use the existing domain/UI package conventions: ESM, strict compiler inheritance, separate declaration build config, `typecheck`, `build`, and Node test scripts. Add workspace links for `@openlearn/domain` and `@openlearn/application` where required. Add `fastify`, `@modelcontextprotocol/sdk`, and the official SDK's schema dependency only to adapter/service packages.

- [ ] **Step 4: Install the locked dependency graph**

Run `pnpm install --lockfile-only`, inspect the importer entries, then run `pnpm install --frozen-lockfile`. Record the existing Node 22 versus repository Node 24 engine warning if it remains.

- [ ] **Step 5: Run package typechecks**

Run `pnpm --recursive run typecheck`. Expected: the new packages compile once their empty source entry points exist; no domain/UI boundary is changed.

- [ ] **Step 6: Commit the scaffold**

```bash
git add packages/application packages/mcp apps/service pnpm-lock.yaml
git commit -m phase-6-package-scaffold
```

### Task 2: Define application actors, capabilities, result envelopes, and ports

**Files:**
- Create: `packages/application/src/contracts.ts`
- Create: `packages/application/src/ports.ts`
- Create: `packages/application/src/errors.ts`
- Create: `packages/application/src/index.ts`
- Create: `packages/application/test/contracts.test.ts`
- Create: `packages/application/test/node-shims.d.ts`

**Interfaces:**

Export these framework-neutral shapes from `@openlearn/application`:

```ts
export type CapabilityScope = 'plan:read' | 'plan:write' | 'progress:write';
export type ActorClass = 'dashboard_session' | 'remote_mcp' | 'local_stdio';

export interface ActorContext {
  readonly ownerId: InternalOwnerId;
  readonly scopes: readonly CapabilityScope[];
  readonly actorClass: ActorClass;
}

export type OperationState =
  | 'received' | 'in_progress' | 'reconciling' | 'succeeded'
  | 'rejected' | 'failed_retryable' | 'cancelled' | 'expired' | 'conflict';

export interface OperationView {
  readonly operationId: string;
  readonly state: OperationState;
}

export interface SafeApplicationError {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}

export interface ApplicationResult<T> {
  readonly outcome: OperationState;
  readonly operation: OperationView;
  readonly value?: T;
  readonly error?: SafeApplicationError;
}
```

Ports must include an owner-scoped plan state read/write boundary, operation reservation/transition access, a mutation marker lookup, a clock, an operation ID generator, and a telemetry sink. The transaction port must be able to commit the accepted domain mutation, terminal operation result, and minimal marker together so a deployed adapter cannot accidentally make those writes independently.

- [ ] **Step 1: Write failing contract tests**

Test that capability constants preserve exact order, operation states contain every ADR state, result envelopes omit `value` on failures, and port types can be implemented without importing transport types.

- [ ] **Step 2: Run the focused application tests and confirm the expected missing-export failure**

Run `pnpm --filter @openlearn/application test`. Expected: failure because the contract module does not yet exist.

- [ ] **Step 3: Implement the minimal contract and port modules**

Keep all types structural and import domain types with `import type`. Define transaction methods around `PlanAggregate`, `AcceptedPlanSnapshot`, `DomainResult`, and bounded operation/marker records. No Fastify request, MCP request, SQL row, token, or raw prompt type may cross this package.

- [ ] **Step 4: Run the focused tests and application typecheck**

Run `pnpm --filter @openlearn/application test` and `pnpm --filter @openlearn/application typecheck`. Expected: all contract assertions pass.

- [ ] **Step 5: Commit the application contract**

```bash
git add packages/application/src packages/application/test
git commit -m phase-6-application-contract
```

### Task 3: Implement authorization, lifecycle coordination, and domain use cases

**Files:**
- Create: `packages/application/src/authorize.ts`
- Create: `packages/application/src/lifecycle.ts`
- Create: `packages/application/src/use-cases.ts`
- Create: `packages/application/src/fingerprint.ts`
- Create: `packages/application/src/testing/memory-state.ts`
- Create: `packages/application/test/authorization.test.ts`
- Create: `packages/application/test/lifecycle.test.ts`
- Create: `packages/application/test/use-cases.test.ts`

**Interfaces:**

Export an `OpenLearnApplication` facade with these methods:

```ts
interface OpenLearnApplication {
  createPlanView(
    actor: ActorContext,
    input: CreatePlanViewInput,
    signal?: AbortSignal,
  ): Promise<ApplicationResult<PlanHandoff>>;
  getPlanView(
    actor: ActorContext,
    input: GetPlanViewInput,
  ): Promise<ApplicationResult<AcceptedPlanSnapshot>>;
  applyProgressAction(
    actor: ActorContext,
    input: ApplyProgressActionInput,
    signal?: AbortSignal,
  ): Promise<ApplicationResult<PlanHandoff>>;
}
```

`CreatePlanViewInput` contains `idempotencyKey`, `candidate: unknown`, `acceptedAt: string`, and optional `planId`/`expectedRevisionId`. `GetPlanViewInput` contains only `planId`. `ApplyProgressActionInput` contains `planId`, `itemId`, the three domain actions, `expectedRevisionId`, `expectedProgressVersion`, `idempotencyKey`, and `confirmedAt: string`.

Use `brandIdentifier` at the application boundary for opaque plan/revision/item references. Let the Phase 4 domain functions perform canonical timestamp, candidate, relationship, owner, deletion, revision, and progress validation. The application maps domain failures to bounded safe errors and never returns raw candidate data.

- [ ] **Step 1: Write failing authorization tests**

Cover each missing scope, a caller with an arbitrary owner-like input in the candidate, and an owner mismatch. Assert the fake domain/state port is not called and the result has no plan value or handoff.

- [ ] **Step 2: Run authorization tests and verify the expected failure**

Run `pnpm --filter @openlearn/application test -- --test-name-pattern authorization`. Expected: missing authorization implementation/export failure.

- [ ] **Step 3: Write failing lifecycle tests**

Cover:

```text
missing key -> rejected
same scope/key/fingerprint -> existing operation
changed fingerprint -> conflict
in_progress -> succeeded
in_progress after lease -> reconciling
matching mutation marker -> succeeded
no mutation marker -> expired
stale fencing version -> conflict
pre-commit abort -> cancelled
```

Use a fake clock and deterministic operation IDs. Assert retries do not invoke the mutation callback twice.

- [ ] **Step 4: Run lifecycle tests and verify they fail for missing behavior**

Run `pnpm --filter @openlearn/application test -- --test-name-pattern lifecycle`. Expected: lifecycle coordinator is not yet implemented.

- [ ] **Step 5: Implement authorization and request fingerprinting**

Require a matching capability scope before each use case. Fingerprints must be deterministic over the capability, plan/item references, expected versions, action, accepted/confirmed timestamp, and a bounded canonical representation of the candidate. Do not log or persist the candidate itself as a deduplication marker.

- [ ] **Step 6: Implement the lifecycle coordinator**

Use the operation and transaction ports to reserve a mutation, enforce the 30-second deadline and 10-second recovery lease, honor `AbortSignal` before commit, apply fencing on reconciliation, and return the existing result for matching duplicate keys. Keep lifecycle transitions explicit and reject invalid transitions.

- [ ] **Step 7: Run lifecycle tests until green**

Run the focused lifecycle test again, then `pnpm --filter @openlearn/application test`. Expected: all lifecycle and contract tests pass.

- [ ] **Step 8: Write failing domain-use-case tests**

Test accepted create, accepted replacement, accepted owner-scoped read, progress compare-and-set, malformed/unsafe candidate, stale revision, stale progress, deleted plan, and non-disclosing unauthorized read. Assert only accepted snapshots can appear in successful values.

- [ ] **Step 9: Implement the three use cases and deterministic memory adapter**

The memory adapter is explicitly test-only and must expose a constructor under `packages/application/src/testing`. It must preserve array order, accepted revisions, progress, operations, markers, and deletion behavior without using current time or random IDs. Production service composition must accept ports rather than instantiate this adapter.

- [ ] **Step 10: Run application tests and typecheck**

Run `pnpm --filter @openlearn/application test` and `pnpm --filter @openlearn/application typecheck`. Expected: authorization, lifecycle, and domain conversion tests pass.

- [ ] **Step 11: Commit the application use cases**

```bash
git add packages/application/src packages/application/test
git commit -m phase-6-application-use-cases
```

### Task 4: Build the official MCP adapter and capability schemas

**Files:**
- Create: `packages/mcp/src/schemas.ts`
- Create: `packages/mcp/src/result-mapping.ts`
- Create: `packages/mcp/src/server.ts`
- Create: `packages/mcp/src/index.ts`
- Create: `packages/mcp/test/schemas.test.ts`
- Create: `packages/mcp/test/server.test.ts`
- Create: `packages/mcp/test/node-shims.d.ts`

**Interfaces:**

`createOpenLearnMcpServer({ application, actor, dashboardOrigin })` returns an official SDK `McpServer`. It registers only tools permitted by the supplied actor scopes:

```text
openlearn.create_plan_view
openlearn.get_plan_view
openlearn.apply_progress_action
```

Tool schemas must reject missing idempotency keys, invalid identifier shapes, extra owner/redirect fields, unsupported actions, and malformed version values before application calls. `candidate` remains untrusted structured data. Result mapping returns both safe structured content and concise text content, setting protocol error metadata for non-success outcomes without leaking raw domain details.

- [ ] **Step 1: Check the official SDK API and write failing schema tests**

Confirm the installed SDK's current `McpServer`, tool registration, stdio transport, and Streamable HTTP transport entry points from its official documentation before importing them. Write tests for exact tool names, required fields, scope-filtered discovery, and rejection of owner/token/redirect arguments.

- [ ] **Step 2: Run the schema tests and observe the expected failure**

Run `pnpm --filter @openlearn/mcp test`. Expected: missing schema/server exports or missing SDK dependency.

- [ ] **Step 3: Implement Zod boundary schemas and safe result mapping**

Keep protocol field names stable and map inputs to application inputs without passing the SDK request object onward. Serialize only `ApplicationResult` fields. Dashboard URLs must be built from the service-controlled origin after validating that it is an allowed HTTPS/loopback origin; no caller-supplied origin is accepted.

- [ ] **Step 4: Register the three tools with the official SDK**

Create a server per authenticated actor for stateless remote handling, and expose only scope-allowed tools. Discovery must contain names/descriptions/version metadata but no plan data.

- [ ] **Step 5: Run MCP tests and typecheck**

Run `pnpm --filter @openlearn/mcp test`, `pnpm --filter @openlearn/mcp typecheck`, and `pnpm --filter @openlearn/mcp build`. Expected: schemas, registration, result mapping, and declaration output pass without application/SDK boundary violations.

- [ ] **Step 6: Commit the MCP adapter**

```bash
git add packages/mcp/src packages/mcp/test
git commit -m phase-6-mcp-adapter
```

### Task 5: Compose the Fastify service and standard transports

**Files:**
- Create: `apps/service/src/config.ts`
- Create: `apps/service/src/auth.ts`
- Create: `apps/service/src/app.ts`
- Create: `apps/service/src/stdio.ts`
- Create: `apps/service/src/http-mcp.ts`
- Create: `apps/service/src/index.ts`
- Create: `apps/service/test/app.test.ts`
- Create: `apps/service/test/transport.test.ts`
- Create: `apps/service/test/node-shims.d.ts`

**Interfaces:**

`createService(dependencies)` accepts:

```ts
interface ServiceDependencies {
  readonly application: OpenLearnApplication;
  readonly authenticateHttp: HttpAuthenticator;
  readonly authenticateStdio: StdioAuthenticator;
  readonly dashboardOrigin: string;
  readonly allowedOrigins: readonly string[];
  readonly buildVersion: string;
}
```

It exposes `/health/live` without learner data and `/health/ready` only when required dependencies/configuration are present. The HTTP MCP endpoint authenticates and validates `Origin` before constructing an actor-bound MCP server/transport. Stdio authentication is explicit and diagnostics never use stdout.

- [ ] **Step 1: Write failing service tests**

Test liveness, readiness failure when dependencies are missing, invalid origin rejection before application invocation, missing/insufficient authentication rejection, and successful authenticated MCP request delegation using a deterministic application fake.

- [ ] **Step 2: Run the service tests and verify the expected failure**

Run `pnpm --filter @openlearn/service test`. Expected: missing service composition exports.

- [ ] **Step 3: Implement bounded configuration and authentication ports**

Read only non-secret configuration names. Do not read or print token values. Authentication adapters return `ActorContext` or a bounded failure; they do not expose raw claims to application or MCP packages. The default test/auth implementation must reject missing credentials rather than create an anonymous actor.

- [ ] **Step 4: Implement Fastify health and Streamable HTTP composition**

Use the official SDK transport integration confirmed in Task 4. Validate `Origin` against the configured allowlist, authenticate before MCP server construction, and return safe protocol/HTTP errors. Keep the service bound to loopback by default in local configuration.

- [ ] **Step 5: Implement stdio startup**

Resolve the local actor through the explicit stdio authenticator, construct the actor-bound MCP server, connect the official stdio transport, and send startup diagnostics to `process.stderr` only.

- [ ] **Step 6: Run service tests and typecheck**

Run `pnpm --filter @openlearn/service test` and `pnpm --filter @openlearn/service typecheck`. Expected: health, auth, origin, stdio-boundary, and HTTP MCP tests pass.

- [ ] **Step 7: Commit the service composition**

```bash
git add apps/service/src apps/service/test
git commit -m phase-6-service-composition
```

### Task 6: Verify boundaries, document the first increment, and prepare the Phase 6 handoff

**Files:**
- Modify: `docs/phases/phase-06-mcp-integration-and-ai-orchestration.md`
- Modify: `docs/ROADMAP.md` only if the status remains accurately `Next`
- Modify: `README.md` only to describe the new boundary without claiming hosted integration
- Modify: this plan
- Create: `packages/application/README.md`, `packages/mcp/README.md`, `apps/service/README.md`

- [ ] **Step 1: Run the complete verification suite**

Run:

```powershell
pnpm run verify
```

Expected: all workspace typechecks, domain/application/MCP/service tests, and package builds pass. Record the Node engine warning if the available runtime remains Node 22.

- [ ] **Step 2: Run boundary and content scans**

Run:

```powershell
git diff --check
rg -n -i "stub|unresolved" packages/application packages/mcp apps/service docs/phases/phase-06-mcp-integration-and-ai-orchestration.md
rg -n -i "postgres|orm|oauth|oidc|bearer|access.?token|raw prompt|dangerouslySetInnerHTML|innerHTML|eval\(" packages/application/src packages/mcp/src apps/service/src
```

Expected: no unresolved markers and no forbidden implementation dependency or unsafe execution pattern. Documentation may mention deferred concepts; runtime source may not.

- [ ] **Step 3: Inspect declaration and package boundaries**

Confirm application declarations contain only domain/framework-neutral types, MCP declarations contain only application/protocol types, and service declarations do not leak raw auth or transport request types into application contracts.

- [ ] **Step 4: Document the implemented increment truthfully**

Add implementation evidence to the Phase 6 document describing the application lifecycle/use-case boundary, scope-filtered MCP adapter, Fastify composition, deterministic test adapters, and the explicit absence of production persistence/auth-provider configuration. Keep Phase 6 `Planned` until the full exit criteria are actually met.

- [ ] **Step 5: Mark completed plan tasks and commit documentation**

```bash
git add packages/application/README.md packages/mcp/README.md apps/service/README.md docs/phases/phase-06-mcp-integration-and-ai-orchestration.md docs/superpowers/plans/2026-08-31-openlearn-phase-6-mcp-integration-and-ai-orchestration.md README.md docs/ROADMAP.md
git commit -m phase-6-boundary-handoff
```

- [ ] **Step 6: Review the branch and report the next safe action**

Run `git status --short --branch`, `git log -n 5 --oneline`, and `git diff main...HEAD --stat`. The final report must distinguish implemented local/test boundaries from deferred production persistence, identity configuration, and provider behavior. Push only after explicit authorization.

## Execution Checkpoints

- Tasks 1 and 2 establish package and type boundaries before behavior exists.
- Task 3 proves authorization, idempotency, lifecycle recovery, and domain conversion without a transport.
- Task 4 proves exact MCP schemas and SDK translation without a deployed service.
- Task 5 proves transport composition and fail-closed auth/origin behavior.
- Task 6 is a handoff gate; it does not mark Phase 6 complete while durable production adapters and configured authentication remain deferred.

## Deferred after this increment

- PostgreSQL migrations, durable repository implementations, and production transaction wiring.
- OIDC/OAuth vendor selection and hosted credential verification.
- Full protocol-client compatibility matrix and deployment configuration.
- AI model/provider SDKs, prompt interpretation, curriculum generation, chat, and tutor behavior.
- Phase 7 learner-facing durable progress workflows beyond the validated capability contract.
