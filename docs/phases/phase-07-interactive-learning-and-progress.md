# Phase 7: Interactive learning and progress

## Status

Planned

## Objective

Allow learners to manage permitted plan items and persist meaningful progress that drives the dashboard from domain state.

## Why this phase matters

A learning plan becomes useful when a learner can act on it and understand what has changed. Progress must survive navigation and sessions, remain explainable, and stay consistent with the validated plan contract.

## Deliverables

- Learner actions to inspect and start plan items.
- Learner actions to edit, pause, complete, and reorder items where the product brief permits them.
- Explicit rules for which plan fields are learner-editable and which require regeneration or review.
- Persisted progress and revision behavior.
- Meaningful state transitions for plan and item lifecycle changes.
- Progress calculations and summaries driven by domain state.
- Dashboard updates that reflect persisted state rather than presentation-only flags.
- Recovery behavior for interrupted, conflicting, or failed updates.
- Learner-readable explanations for progress and completion changes.

## Workstreams

- **Interaction model:** Define action affordances, permissions, confirmations, and learner feedback.
- **State transitions:** Implement and verify allowed plan and item transitions.
- **Persistence:** Store progress and revisions according to the architecture and domain contracts.
- **Visualization:** Update dashboard summaries and detail views from current domain state.
- **Recovery:** Handle interruptions, conflicts, validation failures, and accidental changes safely.

## Dependencies

- [Phase 4: Learning-plan domain model](phase-04-learning-plan-domain-model.md) and its lifecycle and progress semantics.
- [Phase 5: Application shell and static dashboard](phase-05-application-shell-and-static-dashboard.md) and its component states.
- [Phase 6: MCP integration and AI orchestration](phase-06-mcp-integration-and-ai-orchestration.md) and its validated ingestion path.
- The permitted learner actions from the Phase 1 product brief.

## Risks and decisions

- **Risk:** A learner loses progress or an edit silently overwrites another change. **Decision:** Define persistence, revision, conflict, and recovery behavior explicitly.
- **Risk:** Completion rules differ between the UI, domain model, and stored state. **Decision:** Use the domain transition rules as the source of truth.
- **Risk:** Learners cannot explain why a progress value changed. **Decision:** Surface meaningful state transitions and learner-readable summaries.
- **Risk:** Presentation flags appear correct while durable state is stale. **Decision:** Drive visualizations from persisted domain state after every accepted transition.

## Exit criteria

- Permitted learner actions are available with clear affordances and feedback.
- State transitions are tested against the domain contract.
- Progress and relevant plan revisions persist across navigation and sessions.
- Editable-plan rules and conflict or recovery behavior are documented.
- Dashboard visualizations update from current domain state.
- Learners can understand the meaning of their progress and completion changes.

## Next phase

[Phase 8: Personalization and learner feedback](phase-08-personalization-and-learner-feedback.md) uses progress and explicit learner feedback to define consent-aware adaptive behavior.
