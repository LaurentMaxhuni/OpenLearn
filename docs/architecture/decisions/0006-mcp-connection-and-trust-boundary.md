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

The exact tool names, schemas, result envelopes, and compatibility versions belong to Phases 4 and 6. The adapter must call application services rather than repositories or SQL. The application service performs actor checks, request-size limits, input validation, state transitions, transaction handling, idempotency, and structured error mapping.

The request lifecycle is:

1. establish transport and protocol version;
2. authenticate the caller when the transport is remote or otherwise requires credentials;
3. validate origin, capability permission, request size, correlation metadata, and basic shape;
4. call the application command or query with an internal actor context;
5. commit only accepted domain state and return stable identifiers, current status, and safe errors; and
6. emit redacted lifecycle telemetry with request and outcome identifiers.

All external content is data, not instructions to the service. The adapter and domain boundary reject arbitrary code, component names outside the allowlisted product surface, HTML or JavaScript intended for execution, unbounded content, and attempts to select a different actor. Dashboard components render validated state from the component registry; they never execute model-supplied markup.

The service uses explicit cancellation, timeout, duplicate-request, and retry behavior. A failed request cannot erase the last accepted plan. A revision cannot silently overwrite learner-confirmed progress; it must pass the version and state rules defined by the domain contract. Observability records capability, actor class, correlation ID, latency, validation outcome, and failure category while omitting access tokens, authorization codes, raw prompts, and full plan content by default.

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
- Phase 6 must test the SDK adapter against representative clients and protocol versions.
- The domain contract must define idempotency, revision, progress, and partial-result semantics before live tools are enabled.

## Revisit conditions

Revisit this decision if a required client cannot support Streamable HTTP or stdio, if measured workflows need stateful resumability, or if a new MCP transport becomes an accepted standard with a materially better fit. Any compatibility addition must preserve the same application and trust boundaries.

## References

- [MCP transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
- [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [MCP TypeScript SDK server guidance](https://ts.sdk.modelcontextprotocol.io/server)
