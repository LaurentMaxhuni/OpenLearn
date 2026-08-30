# Phase 2: Architecture and technology decisions

## Status

Complete

## Objective

Select and record the technical boundaries that support the agreed product scope without coupling the dashboard to a single external provider or unvalidated AI output.

## Why this phase matters

The Phase 1 product brief defines OpenLearn as a standalone dashboard and reusable component surface used by an external AI client through MCP. The implementation needs shared decisions about the web application, workspace, persistence, deployment, authentication, and MCP boundary before the component and domain work can proceed without rework.

## Deliverables

- A reviewed [architecture baseline](../ARCHITECTURE.md).
- A selected web stack and package-management approach: TypeScript, React, Vite, Node.js, Fastify, and pnpm workspaces.
- A first-party component and design-system approach aligned with the standalone dashboard and Phase 3 UX work.
- A persistence boundary that distinguishes durable plan/progress state from transient integration state, using PostgreSQL behind application ports.
- A container-based deployment target with local, preview, and production environment boundaries.
- Authentication assumptions based on OIDC-compatible dashboard sessions and scoped OAuth 2.1-compatible remote MCP authorization.
- A first-hosted-release principal association that requires one configured identity authority for dashboard and remote MCP ownership, with no implicit cross-provider account linking.
- An authenticated dashboard handoff: accepted plan-view mutations return an opaque plan reference and stable dashboard URL that the calling AI client can present to the learner, with `/plans` as the returning-user landing route.
- An MCP connection model using stdio locally and Streamable HTTP remotely, with explicit trust, origin, authorization, validation, and observability boundaries.
- Retention and deletion assumptions for accepted plans, progress, request metadata, telemetry, backups, and learner-controlled deletion before schema work begins.
- MCP lifecycle behavior for discovery, operation states, idempotency, timeout, cancellation, retries, duplicate requests, and preservation of the last accepted state.
- Six focused [architecture decision records](../architecture/decisions/0001-application-stack-and-workspace.md): stack/workspace, components, persistence, deployment, identity, and MCP.
- A written boundary map between the dashboard, application/domain logic, persistence, authentication, observability, and AI/MCP integration.
- Local development and verification expectations that can be implemented without an undocumented machine state or live AI provider.

## Workstreams

- **Technology selection:** Compare application and package choices against the [Phase 1 product brief](../product-brief.md), then select the TypeScript, React/Vite, Fastify, pnpm, PostgreSQL, and container baseline.
- **Boundary design:** Keep dashboard components, application services, domain state, persistence adapters, authentication, and MCP transport behind explicit dependency directions.
- **MCP connection model:** Use stdio for local client-launched integrations and Streamable HTTP for remote integrations, with OAuth-compatible authorization and untrusted-input validation at the boundary.
- **Ownership and handoff:** Resolve both hosted entry points to one internal owner through a shared canonical issuer, and return an authenticated dashboard URL/reference for the calling client to present to the learner.
- **Lifecycle and retention:** Keep request lifecycle state separate from learner-domain state, make mutation outcomes replayable with a durable minimal deduplication marker beyond full-record retention, and establish deletion/retention invariants before schema implementation.
- **Decision records:** Capture one focused ADR for each consequential choice, including alternatives, consequences, references, and revisit conditions.
- **Implementation handoff:** Define the logical workspace, environment configuration, local database dependency, fixture strategy, and verification contract for the next phases.

## Dependencies

- [Phase 1: Product discovery and scope](phase-01-product-discovery.md) and its [reviewed product brief](../product-brief.md).
- The first-run, returning-user, interruption, and failure journeys.
- The minimum lovable product and its non-goals.
- Official protocol and runtime references recorded in the architecture baseline and ADRs.

## Risks and decisions

- **Risk:** A stack is chosen because it is familiar rather than because it serves the product boundary. **Decision:** Use focused ADRs to compare the split TypeScript stack with co-hosted, serverless, and alternative component approaches.
- **Risk:** UI, domain, persistence, and integration responsibilities become coupled. **Decision:** Keep the dashboard and service independently deployable and route both HTTP and MCP requests through application ports.
- **Risk:** MCP authorization or provider assumptions leak into unrelated application code, or dashboard and MCP credentials resolve to different owners. **Decision:** Use OIDC/OAuth-compatible adapter boundaries, require one canonical issuer for the first hosted flow, map it to an internal owner, and provide an explicit future linking path rather than matching by email or provider identity.
- **Risk:** Learner progress or request state is lost across process changes. **Decision:** Store accepted domain state in PostgreSQL, use transactions and concurrency checks, externalize any bounded cross-instance integration state, and define replayable lifecycle outcomes.
- **Risk:** Schema work bakes in indefinite retention or makes deletion incomplete. **Decision:** Set minimum retention periods, immediate access revocation, bounded purge targets, backup handling, and no-resurrection invariants in the persistence boundary.
- **Risk:** The learner receives no usable path from an external call to the dashboard. **Decision:** Return a stable authenticated plan URL/reference from accepted mutations and define the dashboard authentication, plan-route, and plan-list fallback flows.
- **Risk:** External AI input becomes executable UI or bypasses ownership. **Decision:** Treat all MCP input as untrusted data, validate it before domain work, allow only OpenLearn-owned component states, and reject arbitrary code or markup.
- **Risk:** Architecture records become too broad to review. **Decision:** Keep six ADRs focused on one decision each and keep exact plan schema and MCP tool payloads for Phases 4 and 6.

## Exit criteria

- The [architecture baseline](../ARCHITECTURE.md) records the selected workspace, runtime, dashboard, service, component, persistence, deployment, identity, and MCP boundaries.
- Six ADRs explain the selected options, alternatives, consequences, references, and revisit conditions.
- A boundary diagram and written dependency map are available.
- Local, preview, and production environment expectations are documented without claiming that the runtime exists.
- Authentication assumptions identify the minimum allowed identity data and permission boundary.
- Dashboard ownership association and the accepted-call-to-dashboard handoff are explicit.
- Retention, deletion, backup, and learner-control assumptions are explicit before schema work.
- MCP transport, authorization, trust, validation, lifecycle, failure, retry, cancellation, duplicate, timeout, and observability expectations are explicit.
- Phase 3 has clear inputs for its design-system, dashboard UX, accessibility, and state-work specification.

## Next phase

[Phase 3: Design system and dashboard UX](phase-03-design-system-and-dashboard-ux.md) turns the selected boundaries and Phase 1 journeys into a reviewable visual, responsive, accessible, and component-state contract.
