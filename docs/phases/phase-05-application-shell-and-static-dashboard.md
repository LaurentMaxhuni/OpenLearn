# Phase 5: Application shell and static dashboard

## Status

Complete

## Implementation evidence

Phase 5 is implemented in `apps/dashboard` and `packages/ui`. The dashboard provides browser-history navigation for `/plans` and `/plans/:planId`, maps deterministic Phase 4 snapshots into presentation-only view models, and exposes a labeled static preview selector for accepted, partial, completed, empty, loading, invalid, retryable, pending, recovering, and conflict states. The UI package supplies reusable semantic components for trust, goal/context, progress, next action, outline, focused item, resources, recovery, and plan data controls.

The shell and components keep live authentication, persistence, AI, MCP, provider, and network concerns outside the presentation boundary. Focus management, keyboard-operable disclosures, live status regions, safe resource rendering, responsive layout tokens, and reduced-motion behavior are covered by the implementation and review checks. `pnpm run verify` passes on the available environment; pnpm reports an existing Node 22 versus the repository's Node 24 engine baseline warning.

## Objective

Build a navigable application shell and reusable dashboard components using deterministic seeded data that conforms to the learning-plan contract.

## Why this phase matters

The project can validate layout, composition, responsiveness, and state communication before adding live AI or external integration complexity. A deterministic dashboard also gives later phases a stable visual target.

## Deliverables

- A navigable application shell aligned with the product journeys.
- Page layout and routing for the initial dashboard experience.
- Reusable components for goals, topics, milestones, plan items, and progress.
- Deterministic seeded data representing realistic plan states.
- Responsive behavior for the supported viewport sizes and interaction modes.
- Visual states for empty, loading, partial, invalid, error, and completed content.
- Composition rules that keep presentation components separate from future integrations.
- A clear handoff from domain state to dashboard visualization.

Live AI and external integrations are not part of this phase. The dashboard is intentionally driven by deterministic data until the MCP and AI orchestration boundary is ready.

## Workstreams

- **Application shell:** Establish navigation, page structure, and route-level boundaries.
- **Dashboard composition:** Assemble reusable components around the domain contract.
- **Seeded states:** Represent normal, empty, partial, invalid, loading, error, and completed plan views.
- **Responsive and accessible behavior:** Verify layout, readable hierarchy, input modes, and state communication.

## Dependencies

- [Phase 2: Architecture and technology decisions](phase-02-architecture-decisions.md) and its application boundaries.
- [Phase 3: Design system and dashboard UX](phase-03-design-system-and-dashboard-ux.md) and its UX contract.
- [Phase 4: Learning-plan domain model](phase-04-learning-plan-domain-model.md) and its canonical data contract.

## Risks and decisions

- **Risk:** Layout instability or unreadable hierarchy makes the first dashboard difficult to use. **Decision:** Test representative seeded states across supported responsive modes.
- **Risk:** Accessibility is deferred until live integrations arrive. **Decision:** Treat semantic, keyboard, focus, contrast, text, and motion behavior as part of the static shell.
- **Risk:** Presentation components become coupled to future providers. **Decision:** Render domain-shaped deterministic data and keep integration concerns outside the component boundary.
- **Risk:** Static states imply that live AI or external services are already connected. **Decision:** Label seeded behavior as deterministic during this phase.

## Exit criteria

- A learner can navigate the initial shell and view a representative seeded plan.
- Reusable dashboard components render goals, topics, milestones, plan items, and progress.
- Representative seeded states cover normal, empty, loading, partial, invalid, error, and completed content.
- Responsive and accessibility behavior is verified against the Phase 3 acceptance criteria.
- The shell is ready to receive validated plan data from Phase 6 without a presentation rewrite.

## Next phase

[Phase 6: MCP integration and AI orchestration](phase-06-mcp-integration-and-ai-orchestration.md) connects the validated external capability boundary to the domain model and static dashboard.
