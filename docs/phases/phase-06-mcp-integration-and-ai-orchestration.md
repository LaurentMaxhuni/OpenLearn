# Phase 6: MCP integration and AI orchestration

## Status

Planned

## Objective

Implement the selected MCP connection boundary and safely transform AI-generated learning plans into validated application state.

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
