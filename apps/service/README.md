# OpenLearn service composition

`apps/service` is the Fastify composition boundary for the Phase 6 increment. `createService` requires an application instance, explicit HTTP and stdio authenticators, and an operation-ID source. It fails closed when those dependencies are absent; it does not construct an anonymous actor or a production memory store.

The service provides:

- `/health/live` and dependency-driven `/health/ready` endpoints;
- a `/mcp` Streamable HTTP endpoint using the official SDK, with an Origin allowlist and HTTP authentication checked before constructing the actor-bound MCP server; and
- `startStdio`, which authenticates a local actor, connects the official stdio transport, and writes its startup diagnostic to `stderr`.

The first increment uses stateless JSON responses for remote Streamable HTTP requests. Durable sessions, production persistence, and an OAuth/OIDC provider are intentionally deferred. `serviceConfigFromEnv` reads only the non-secret service settings; credential verification remains an injected adapter.

Run its checks with:

```powershell
pnpm --filter @openlearn/service test
```
