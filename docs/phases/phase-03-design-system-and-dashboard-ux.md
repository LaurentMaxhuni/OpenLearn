# Phase 3: Design system and dashboard UX

## Status

Next

## Objective

Define the responsive, accessible dashboard experience and the visual language that will make learning goals, topics, milestones, and progress understandable.

## Why this phase matters

The dashboard will be the learner's primary view of a generated plan. Clear hierarchy, predictable states, and accessible interaction rules must be agreed before the application shell and domain model are implemented.

## Deliverables

- Dashboard information architecture tied to the agreed learner journeys.
- Responsive layout behavior across supported viewport sizes.
- Design tokens for color, typography, spacing, shape, elevation, and motion where needed.
- Component inventory with default, focus, disabled, empty, loading, error, and success states.
- Accessible names, keyboard behavior, focus order, contrast expectations, and reduced-motion behavior.
- Visual patterns for goals, topics, milestones, plan items, and progress.
- Empty, loading, partial, invalid, and recoverable-error states.
- A clear distinction between learner-confirmed state and untrusted or pending AI-generated content.

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

## Exit criteria

- A reviewed UX specification describes the dashboard information architecture and primary journeys.
- A token and component-state inventory covers the core dashboard surfaces.
- Responsive behavior is defined for supported viewport sizes and interaction modes.
- Accessibility acceptance criteria cover names, focus, keyboard behavior, contrast, text, and motion.
- Empty, loading, partial, invalid, and error states are specified before Phase 4 begins.

## Next phase

[Phase 4: Learning-plan domain model](phase-04-learning-plan-domain-model.md) defines the stable data contract that the dashboard UX will render and external integrations will produce or consume.
