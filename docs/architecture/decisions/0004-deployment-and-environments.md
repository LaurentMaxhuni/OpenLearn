# ADR-0004: Deployment and environment model

**Status:** Accepted

## Context

OpenLearn has two different application surfaces: a browser dashboard and a service that handles learner API requests and MCP traffic. They need independent trust, scaling, and release boundaries, but the project should remain portable across hosting providers. Local development must also exercise the same service boundary without requiring a private account or undocumented machine setup.

## Decision

Target OCI-compatible container deployment with two application units:

1. a dashboard unit that serves the built standalone browser assets; and
2. a service unit that runs the learner API and MCP adapter.

Use a managed PostgreSQL 18 instance for hosted environments. Put both application units behind TLS at the deployment edge, expose only the dashboard's public web surface and the service endpoints that the product requires, and keep the database on a private network or provider-equivalent private boundary. The deployment vendor is intentionally not selected by this ADR.

Use three isolated environments:

- **Local:** developers run the dashboard and service from the workspace and start PostgreSQL through a declared container-based local dependency. Local MCP integrations use stdio; if HTTP is needed, the service binds to loopback by default.
- **Preview:** each preview uses its own service configuration and isolated database or resettable database namespace. Preview identities and fixture data are never production learner data.
- **Production:** dashboard and service deployments use TLS, runtime-injected secrets, a managed PostgreSQL instance, health checks, redacted structured logs, and a documented recovery path.

The first deployment has no worker or queue requirement. Long-running request orchestration may introduce one later, but it must not be smuggled into the first service as unbounded in-process background work.

Each deployment must expose separate liveness and readiness signals, identify its build version, and fail closed when required configuration is missing. Environment variables or an equivalent secret-injection mechanism supply database URLs, session keys, OAuth configuration, allowed origins, and public service URLs. Secrets, access tokens, and production data must not be committed or baked into browser assets.

## Alternatives considered

### Co-hosted serverless application

A provider-managed full-stack deployment could reduce operations, but it would couple MCP connection behavior and persistence lifecycle to provider-specific execution limits. The selected container target keeps the service boundary portable and gives local development a closer production shape.

### Single virtual machine

A single machine is straightforward for an early demo, but it couples dashboard and service releases and makes independent scaling or rollback less clear. It can remain a valid hosting implementation if it still runs the same two application units and environment boundaries.

### Static dashboard without a service boundary

A static-only dashboard would not provide a trusted place for MCP writes, ownership checks, or durable progress. It is insufficient for the minimum lovable product.

## Consequences

Positive consequences:

- The dashboard and MCP service can be released, scaled, and protected independently.
- The deployment remains portable across container-capable hosts.
- Preview and production data boundaries are explicit.
- Local development can reproduce the service and database boundary without a live AI provider.

Costs and constraints:

- The project owns two application build and release paths.
- CORS, cookies, service URLs, TLS, and health checks need explicit configuration.
- A managed database remains an operational dependency in hosted environments.

## Revisit conditions

Revisit this decision if measured traffic favors a single deployment unit without weakening MCP isolation, if the selected host cannot support the required Streamable HTTP behavior, or if a worker becomes necessary for a defined, tested long-running capability.
