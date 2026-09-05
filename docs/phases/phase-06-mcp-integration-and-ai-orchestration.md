# Phase 6: MCP integration and AI orchestration

## Status

Local slice

## Objective

Implement the selected MCP connection boundary and safely transform AI-generated learning plans into validated application state.

## Implemented first increment (2026-08-31)

The approved first implementation slice is present in the repository and covered by deterministic tests:

- `@openlearn/application` defines framework-neutral actor capabilities, operation lifecycle ports, request fingerprints, idempotent mutation handling, cancellation, recovery leases, fencing metadata, safe failures, and accepted-plan/progress use cases. Its in-memory state adapter is test-only.
- `@openlearn/mcp` uses the official MCP TypeScript SDK. It registers the exact three Phase 6 tools, filters discovery by the supplied actor scopes, validates strict protocol inputs, and maps safe application results into the `openlearn.phase6.v1` structured envelope and concise text content. Stdio and Streamable HTTP transport factories are available; legacy HTTP+SSE is not introduced.
- `apps/service` composes Fastify health endpoints and stateless Streamable HTTP handling. It validates controlled origins and authenticates HTTP requests before constructing an actor-bound MCP server. Local stdio startup requires an explicit authenticator and keeps diagnostics on `stderr`.

The full workspace verification passes on the available runtime. Phase 6 is a `Local slice`: this increment does not claim a production persistence adapter, configured identity provider, durable MCP session store, deployment configuration, provider/model SDK, prompt interpretation, or a complete protocol-client compatibility matrix. Those hosted concerns remain in Phase 10.

## Why this phase matters

MCP servers and model responses are external inputs with their own availability, authorization, and correctness concerns. A deliberate boundary protects the domain model and gives learners understandable failure and uncertainty states.

## Deliverables

- The selected MCP connection boundary from Phase 2.
- Capability discovery and capability version expectations.
- A request lifecycle covering initiation, progress, completion, cancellation, and failure.
- Authorization and identity checks for MCP capabilities.
- Input and output validation against the Phase 4 domain contract.
- Retry, timeout, cancellation, and duplicate-request behavior.
- User-visible error, partial-result, validation-failure, and recovery states.
- Observability for requests, failures, latency, validation outcomes, and provider responses without exposing sensitive content unnecessarily.
- A conversion path that treats an AI-generated plan as untrusted input until validation succeeds.

## Workstreams

- **Connection boundary:** Encapsulate MCP transport, capability discovery, and provider lifecycle behavior.
- **Request orchestration:** Define request state, cancellation, retry, timeout, and duplicate handling.
- **Trust and authorization:** Enforce identity, capability permissions, output validation, and safe failure behavior.
- **Domain conversion:** Normalize accepted output into the canonical plan contract and preserve meaningful validation errors.
- **Observability:** Record actionable operational signals while respecting privacy and data-minimization requirements.

## Dependencies

- [Phase 2: Architecture and technology decisions](phase-02-architecture-decisions.md) and the selected MCP connection model.
- [Phase 4: Learning-plan domain model](phase-04-learning-plan-domain-model.md) and its validation contract.
- [Phase 5: Application shell and static dashboard](phase-05-application-shell-and-static-dashboard.md) and its UI states.

## Risks and decisions

- **Risk:** Prompt injection or untrusted model output changes application behavior. **Decision:** Treat all external instructions and generated content as untrusted, validate outputs, and constrain side effects.
- **Risk:** Authorization leakage exposes a capability or learner data to the wrong context. **Decision:** Check identity and capability permissions at the integration boundary.
- **Risk:** Provider failure or network instability creates confusing or duplicated learner state. **Decision:** Define timeouts, retries, cancellation, idempotency, and recoverable error states.
- **Risk:** Integration failures are invisible to maintainers. **Decision:** Add privacy-aware observability for lifecycle, validation, and failure outcomes.

## Exit criteria

- MCP capability discovery and request lifecycle behavior are defined and tested.
- Authorization and input/output validation protect the domain boundary.
- Retries, timeouts, cancellation, duplicate requests, and provider failures have explicit behavior.
- AI-generated output is converted into the canonical domain model only after validation.
- Learners receive understandable pending, partial, invalid, failure, and recovery states.
- Requests and validation outcomes are observable without unnecessary sensitive-data exposure.
- An end-to-end plan-ingestion path is suitable for interactive progress work in Phase 7.

## Next phase

[Phase 7: Interactive learning and progress](phase-07-interactive-learning-and-progress.md) builds learner actions and durable progress on top of validated plan state.
