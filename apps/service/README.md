# OpenLearn service composition

`apps/service` is the Fastify composition boundary for the learner API and MCP service. `createService` requires an application instance, explicit HTTP and stdio authenticators, and an operation-ID source. It fails closed when those dependencies are absent; it does not construct an anonymous actor or a production memory store.

The service provides:

- `/health/live` and dependency-driven `/health/ready` endpoints;
- a `/mcp` Streamable HTTP endpoint using the official SDK, with an Origin allowlist and HTTP authentication checked before constructing the actor-bound MCP server; and
- OAuth protected-resource metadata at `/.well-known/oauth-protected-resource` plus a `WWW-Authenticate` discovery challenge when MCP metadata is configured;
- authenticated `/api/plans` reads, progress, and deletion with dashboard-session CSRF protection;
- protected Prometheus-style metrics, request IDs, security headers, and a bounded per-instance rate guard;
- `startStdio`, which authenticates a local actor, connects the official stdio transport, and writes its startup diagnostic to `stderr`; and
- `migrate` and `maintenance` commands for database setup and bounded operation/retention work.

The service remains provider-neutral: `@openlearn/identity` verifies configured OIDC/OAuth credentials and `@openlearn/persistence` supplies PostgreSQL state, while the entrypoint composes them. A deployment still supplies its OIDC login/callback or trusted identity gateway; raw provider claims and tokens stop at the identity adapter.

Run its checks with:

```powershell
pnpm --filter @openlearn/service test
```
