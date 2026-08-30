# Phase 3: Design system and dashboard UX

## Status

Complete

## Objective

Define the responsive, accessible dashboard experience and the visual language that will make learning goals, topics, milestones, and progress understandable.

## Completed specification

The reviewed Phase 3 UX and design-system contract is [OpenLearn Phase 3: Dashboard UX and design-system specification](../superpowers/specs/2026-08-30-openlearn-phase-3-dashboard-ux-design.md). It is the source of detail for the information architecture, routes, responsive composition, tokens, accessibility criteria, component inventory, state matrix, view-model boundary, fixture guidance, and phase handoffs below.

## Why this phase matters

The dashboard will be the learner's primary view of a generated plan. Clear hierarchy, predictable states, and accessible interaction rules must be agreed before the application shell and domain model are implemented.

## Deliverables

- [x] Dashboard information architecture tied to the agreed learner journeys.
- [x] Responsive layout behavior across compact, medium, and wide viewport bands.
- [x] Design tokens for color, typography, spacing, shape, elevation, and motion.
- [x] Component inventory with default, focus, disabled, empty, loading, error, and success states.
- [x] Accessible names, keyboard behavior, focus order, contrast expectations, text reflow, and reduced-motion behavior.
- [x] Visual patterns for goals, topics, milestones, plan items, and progress.
- [x] Empty, loading, partial, invalid, interrupted, recovering, and recoverable-error states.
- [x] A clear distinction between learner-confirmed state and untrusted or pending externally supplied content.
- [x] Deterministic fixture guidance and a framework-neutral `packages/ui` view-model boundary.
- [x] An authorized dashboard `Delete plan` action with accessible confirmation, pending/recovery/failure, committed-deletion, and non-disclosing unavailable states.
- [x] A required `Undo completion` action for completed learner items, including pending and failure behavior that preserves confirmed state.

## Workstreams

- **Information architecture:** Establish the hierarchy and navigation of the dashboard experience.
- **Responsive composition:** Define how the layout adapts while preserving task priority and readable content.
- **Design language:** Define reusable tokens and component states without committing to an implementation framework prematurely.
- **Accessibility:** Specify semantics, keyboard access, focus behavior, contrast, text sizing, and assistive-technology expectations.
- **State communication:** Make progress, uncertainty, loading, empty, and error conditions visible and actionable.

## Dependencies

- [Phase 1: Product discovery and scope](phase-01-product-discovery.md) and its learner journeys.
- [Phase 2: Architecture and technology decisions](phase-02-architecture-decisions.md) and its selected boundaries.
- The minimum lovable product and the first dashboard experience.

## Risks and decisions

- **Risk:** Visual inconsistency makes plan state difficult to understand. **Decision:** Maintain a shared token and component-state inventory.
- **Risk:** A design works on one viewport or input mode but fails elsewhere. **Decision:** Define responsive and accessibility behavior as acceptance criteria.
- **Risk:** Loading or error states hide whether a plan is trustworthy. **Decision:** Distinguish pending, validated, learner-confirmed, and failed states in the UX.
- **Risk:** Untrusted AI output is presented as authoritative. **Decision:** Make validation and learner confirmation visible in the experience.

## Review outcome

The specification satisfies the Phase 3 exit criteria and creates the documented UX prerequisite for Phase 4. It explicitly covers the required learner data-control action and reversible completion action. Phase 4 may now define the canonical domain contract against the explicit view-model and state requirements; this phase does not define the domain schema or implementation framework.

## Exit criteria

- [x] A reviewed UX specification describes the dashboard information architecture and primary journeys.
- [x] A token and component-state inventory covers the core dashboard surfaces.
- [x] Responsive behavior is defined for supported viewport sizes and interaction modes.
- [x] Accessibility acceptance criteria cover names, focus, keyboard behavior, contrast, text, and motion.
- [x] Empty, loading, partial, invalid, and error states are specified before Phase 4 begins.
- [x] Required learner data-control and reversible-progress actions are specified with accessible confirmation, application intents, and recovery behavior.

## Next phase

[Phase 4: Learning-plan domain model](phase-04-learning-plan-domain-model.md) defines the stable data contract that the dashboard UX will render and external integrations will produce or consume.
