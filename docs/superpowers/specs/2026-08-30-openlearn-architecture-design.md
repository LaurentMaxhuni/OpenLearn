# OpenLearn Architecture Baseline Design

**Status:** Approved for implementation

**Scope:** Phase 2: Architecture and technology decisions

## Goal

Define a portable technical baseline for OpenLearn's standalone learner dashboard, reusable component package, durable plan state, and external AI-client capability surface.

## Context

OpenLearn is not the system that interprets a learner's request or generates curriculum. A connected AI client performs that work and calls OpenLearn through MCP. OpenLearn validates plan-shaped input, manages accepted state and learner progress, and renders that state through reusable components.

The repository currently contains documentation only. This design records the boundaries that the implementation phases must preserve without claiming that the application, persistence, dashboard, or MCP service is available today.

## Selected approach

Use a pnpm workspace with TypeScript across the runtime. Build the standalone dashboard as a React application with Vite. Build a separate Node.js service with Fastify for the learner-facing HTTP API and MCP adapter. Keep domain, application, UI, persistence, and MCP concerns in separate packages so the two deployable applications share contracts without sharing transport or storage internals.

Use PostgreSQL 18 as the durable store. Deploy the dashboard and service as separate OCI-compatible units with a managed PostgreSQL instance in hosted environments. Use OIDC-compatible dashboard sessions and OAuth 2.1-compatible authorization for remote MCP requests. Use stdio for client-launched local integrations and Streamable HTTP for remote integrations through the official MCP TypeScript SDK.

The remote MCP endpoint is stateless by default. Every tool call is authenticated, scoped, validated, and routed to an application service. It cannot access the database directly, execute generated code, or select arbitrary UI markup. The UI chooses from OpenLearn-owned components based on validated domain state.

## Decision summary

| Concern | Decision | Primary consequence |
| --- | --- | --- |
| Workspace and runtime | pnpm workspace; TypeScript; Node.js 24 LTS | Shared types and tooling across independently deployable applications |
| Dashboard | React + Vite standalone application | Fast component iteration and a clear browser boundary without server-rendering requirements |
| Service | Node.js + Fastify service | One typed service boundary for learner HTTP operations and MCP adaptation |
| Components | First-party React package with CSS custom-property tokens | OpenLearn owns the visual primitives and avoids an early UI-kit lock-in |
| Durable state | PostgreSQL 18 behind persistence ports | Transactions, ownership, revisions, and progress survive process or instance changes |
| Deployment | Separate dashboard and service OCI units plus managed PostgreSQL | Independent scaling and clear trust boundaries without a cloud-provider lock-in |
| Dashboard identity | OIDC-compatible browser session | Domain identity uses issuer and subject, not email or AI-provider identity |
| Remote MCP auth | OAuth 2.1-compatible resource authorization | Tool calls are scoped to a resource and acting identity |
| MCP transports | stdio locally; Streamable HTTP remotely | Local client compatibility and a current remote transport with one service endpoint |

## Boundary map

The architecture is organized around dependencies pointing inward toward domain and application ports:

```mermaid
flowchart LR
    learner[ Learner browser ] -->|HTTPS| dashboard[Dashboard app]
    dashboard -->|Learner API| service[Application service]
    ai[External AI client] -->|stdio locally or Streamable HTTP remotely| mcp[MCP adapter]
    mcp --> service
    service --> app[Application services]
    app --> domain[Domain state and validation]
    app --> ports[Persistence and auth ports]
    ports --> db[(PostgreSQL)]
    auth[OIDC/OAuth boundary] --> dashboard
    auth --> mcp
    service --> telemetry[Redacted observability]
```

The dependency rules are:

- Dashboard components may consume UI view models and invoke typed learner-action ports. They do not import MCP transport objects, database clients, access tokens, or provider SDKs.
- The dashboard application may call the service's learner API. It does not connect directly to PostgreSQL or to an external AI client.
- The MCP adapter translates protocol requests into application commands and query requests. It does not contain business rules and does not access persistence directly.
- Application services coordinate authorization, validation, domain transitions, persistence transactions, idempotency, and structured results.
- Domain code owns plan lifecycle, learner-progress semantics, identifiers, ordering, and validation rules once Phase 4 defines them. It imports no UI, transport, or database package.
- Persistence adapters implement ports defined outside the database package. They may map domain records to PostgreSQL rows but may not leak row models into the UI or MCP adapter.
- Authentication adapters verify external credentials and return a minimal internal actor context. Domain code receives an actor and permissions, not raw tokens or provider-specific claims.
- Observability receives event metadata and outcome codes with correlation identifiers. It does not receive raw prompts, bearer tokens, or full plan content by default.

## Logical workspace layout

The scaffold should use these responsibilities; exact package names can be adjusted only with an architecture record:

```text
apps/
  dashboard/       React/Vite browser application
  service/         Fastify HTTP API and MCP endpoint
packages/
  ui/              First-party React components and presentation tokens
  domain/          Plan state, identifiers, lifecycle, and validation contracts
  application/     Use cases, actor context, ports, and structured results
  persistence/     PostgreSQL adapters and migrations
  mcp/             MCP transport/registration adapter and request mapping
  config/           Shared TypeScript, lint, and test configuration where useful
```

The UI package may depend on shared domain-facing view-model types, but the domain and application packages must not depend on `ui`. The MCP package may depend on application ports and contract types, but the application package must not depend on MCP. The service application composes adapters; it is the only package allowed to assemble the full runtime graph.

## State and request flow

1. A dashboard request or MCP tool call arrives with an actor context established by the relevant authentication boundary.
2. The adapter checks transport-level requirements, request size, correlation metadata, and capability permissions.
3. The application service validates the command against the versioned domain contract and applies the permitted state transition.
4. A persistence transaction writes accepted domain state and its revision or progress change. Duplicate requests use an idempotency key or equivalent version check.
5. The service returns a structured result containing the outcome, stable identifiers, current state, and safe learner-facing or client-facing error information.
6. The dashboard converts query results into view models and renders the appropriate component state. The MCP adapter converts the same application result into protocol-shaped output.

MCP requests must never cause arbitrary component code, HTML, JavaScript, or database queries to execute. Plan content is data. The component registry and state mapping remain OpenLearn-owned code.

## Environment model

The implementation must define three environments:

- **Local:** dashboard and service run from the workspace; PostgreSQL is supplied by a declared local container or an explicitly documented local alternative; local MCP clients use stdio and the service binds only to loopback when HTTP is needed.
- **Preview:** a disposable dashboard and service deployment uses an isolated database and non-production credentials; it may use fixture data and test identities but must not share learner data with production.
- **Production:** dashboard and service use separate deployment units, TLS, a managed PostgreSQL instance, runtime-injected secrets, monitored health endpoints, and privacy-aware logs.

No environment may depend on a developer's undocumented global database, provider account, or locally stored token. The implementation must pin the Node and package-manager versions and provide reproducible setup and verification commands.

## Deliberately deferred decisions

- Phase 3 defines design tokens, responsive behavior, accessibility acceptance criteria, and the complete component-state inventory.
- Phase 4 defines the canonical plan schema, stable identifiers, lifecycle transitions, progress semantics, and version envelope.
- Phase 6 defines exact MCP tool names, payloads, capability discovery details, request cancellation, retries, and provider-facing compatibility behavior.
- The identity-provider vendor, deployment vendor, database host, and package registry are not selected by this baseline.
- Public distribution and semantic-versioning rules for the UI package are deferred until a consumer outside the dashboard exists.

## Phase 3 handoff

Phase 3 can design the dashboard against a stable ownership boundary: React components render explicit view models supplied by the dashboard application, while pending, partial, invalid, failed, and learner-confirmed states remain visible. It should not introduce MCP request objects, authentication claims, or database records into component props.

## References

- [Node.js release guidance](https://nodejs.org/en/about/previous-releases)
- [React TypeScript guidance](https://react.dev/learn/typescript)
- [Vite library mode](https://vite.dev/guide/build.html#library-mode)
- [Fastify TypeScript reference](https://fastify.dev/docs/latest/Reference/TypeScript/)
- [pnpm workspaces](https://pnpm.io/workspaces)
- [PostgreSQL supported versions](https://www.postgresql.org/support/versioning/)
- [MCP transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
- [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [MCP TypeScript SDK server guidance](https://ts.sdk.modelcontextprotocol.io/server)
