# Phase 4: Learning-plan domain model

## Status

Planned

## Objective

Define the canonical learning-plan contract that safely connects AI or MCP input, persistence, learner actions, and dashboard rendering.

## Why this phase matters

The dashboard and integration layers need one dependable representation of a learning plan. Explicit validation, lifecycle, ordering, and progress semantics prevent each layer from inventing its own interpretation.

## Deliverables

- A canonical learning-plan schema.
- Validation rules for required, optional, malformed, incomplete, and unknown fields.
- Stable identifiers for plans, goals, topics, milestones, and plan items.
- Lifecycle states and allowed transitions for a plan and its items.
- Ordering rules for goals, topics, milestones, and items.
- Progress semantics that explain how completion and partial progress are represented.
- Versioning rules for plan revisions and migrations.
- Safe handling for incomplete or invalid AI-generated output.
- Fixtures and contract examples for valid, incomplete, invalid, and versioned plans.
- A documented contract shared by MCP ingestion, persistence, and dashboard rendering.

## Workstreams

- **Schema design:** Define the entities, fields, identifiers, relationships, and version envelope.
- **Validation:** Define accepted input, rejection behavior, normalization, and safe partial-state handling.
- **Lifecycle and progress:** Define state transitions, ordering, completion, pause, and revision semantics.
- **Contract fixtures:** Provide examples that later integration, persistence, and UI tests can share.

## Dependencies

- [Phase 2: Architecture and technology decisions](phase-02-architecture-decisions.md) and its domain/persistence boundaries.
- [Phase 3: Design system and dashboard UX](phase-03-design-system-and-dashboard-ux.md) and its state requirements.
- The product brief and first dashboard experience from Phase 1.

## Risks and decisions

- **Risk:** Schema drift causes the UI, persistence, and integration layers to disagree. **Decision:** Treat the domain model as the shared contract and version it explicitly.
- **Risk:** Progress semantics are ambiguous or impossible to explain. **Decision:** Define observable state transitions and learner-readable meanings.
- **Risk:** Model output contains invalid, incomplete, or unexpected fields. **Decision:** Validate at the integration boundary and represent failure or incompleteness explicitly.
- **Risk:** Unsafe data is accepted because it resembles a valid plan. **Decision:** Make validation and rejection behavior part of the domain contract.

## Exit criteria

- A reviewed canonical learning-plan schema exists.
- Validation examples cover valid, incomplete, invalid, and versioned input.
- Identifiers, lifecycle states, ordering, progress semantics, and revision rules are explicit.
- Safe handling of incomplete or invalid AI output is specified.
- Contract tests or equivalent fixtures are defined for the Phase 6 integration boundary.
- Phase 5 can render representative deterministic plan states from the contract.

## Next phase

[Phase 5: Application shell and static dashboard](phase-05-application-shell-and-static-dashboard.md) uses deterministic data conforming to this contract to establish the navigable learner experience.
