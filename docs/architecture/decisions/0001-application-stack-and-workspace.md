# ADR-0001: Application stack and workspace

**Status:** Accepted

## Context

OpenLearn needs a standalone dashboard, a reusable component surface, and a service boundary that can receive learner-plan operations from external AI clients. The dashboard and MCP boundary have different runtime concerns, but they must share domain and application contracts. The repository has no application runtime yet, so the baseline must support incremental implementation without hiding the boundary inside a provider-specific platform.

## Decision

Use a single pnpm workspace with TypeScript across the runtime and these logical units:

```text
apps/dashboard       React application built with Vite
apps/service         Node.js service built with Fastify
packages/ui          First-party React components and presentation tokens
packages/domain      Domain types, validation, identifiers, and state rules
packages/application Use cases, actor context, ports, and result types
packages/persistence PostgreSQL adapters and migrations
packages/mcp         MCP transport and request-mapping adapter
packages/config      Shared tool and compiler configuration where useful
```

Use Node.js 24 LTS as the initial runtime baseline, with the version pinned in the repository toolchain configuration when the scaffold is created. Use pnpm workspace commands rather than adding a second monorepo orchestrator during the first implementation cycle.

The dashboard is a standalone React/Vite application. The service is a separately deployable Fastify application that exposes the learner API and hosts the MCP adapter. The dashboard and service share typed packages but do not share process, transport, or persistence internals.

The service composes the runtime graph. Domain and application packages remain independent of React, Fastify, MCP, PostgreSQL, and any identity provider.

## Alternatives considered

### Co-hosted full-stack framework

A single framework could serve dashboard routes, APIs, and MCP handlers from one application. It would reduce the number of deployable units, but it would make transport lifecycles, UI code, and external capability concerns easier to couple. It also makes future component consumption depend on the framework's server model.

### Static dashboard plus provider-specific serverless handlers

This would minimize initial server management, but MCP request behavior, durable transactions, and local parity would depend on a deployment provider. It would also make local stdio and remote HTTP behavior harder to exercise through one service boundary.

### Separate repositories for dashboard and service

Separate repositories would isolate deployments, but they would add contract publishing and version coordination before OpenLearn has an external component consumer. A workspace gives the project package-level boundaries without that operational overhead.

## Consequences

Positive consequences:

- UI, domain, persistence, and MCP responsibilities have visible package boundaries.
- The dashboard can evolve independently from remote MCP transport behavior.
- Shared TypeScript contracts reduce drift between the dashboard and service.
- The workspace can later publish the UI package without moving the application boundary.
- A Node.js LTS baseline and one package manager give contributors a reproducible starting point.

Costs and constraints:

- The first deployment operates at least two application units.
- The dashboard needs an explicit learner API and cross-origin/session policy if the units use different origins.
- Shared packages need dependency rules and build ordering before implementation begins.
- Vite is chosen for a client-rendered standalone dashboard; server rendering and SEO are not first-cycle requirements.

## Revisit conditions

Revisit this decision if the dashboard requires server rendering for a validated product reason, if the service and dashboard cannot be deployed independently in the selected environment, or if an external consumer requires a framework-neutral component package rather than the React package selected for the first host.

## References

- [Node.js release guidance](https://nodejs.org/en/about/previous-releases)
- [React TypeScript guidance](https://react.dev/learn/typescript)
- [Vite library mode](https://vite.dev/guide/build.html#library-mode)
- [Fastify TypeScript reference](https://fastify.dev/docs/latest/Reference/TypeScript/)
- [pnpm workspaces](https://pnpm.io/workspaces)
