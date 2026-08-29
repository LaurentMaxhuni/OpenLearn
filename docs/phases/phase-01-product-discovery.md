# Phase 1: Product discovery and scope

## Status

Next

## Objective

Produce a bounded product brief for the primary learner and maintainer problems that OpenLearn intends to solve first.

## Why this phase matters

The project combines learning plans, dashboard visualization, AI assistance, and MCP connections. A product boundary is needed before technical choices or interface work can be evaluated consistently.

## Deliverables

- A primary learner profile with goals, constraints, context, and expected outcomes.
- A maintainer and contributor profile covering stewardship, support, and quality responsibilities.
- A first-run journey from a learner goal to a usable learning-plan view.
- A returning-user journey covering plan review, progress inspection, and the next useful action.
- A minimum lovable product that names the smallest coherent learner experience.
- A description of the first dashboard experience, including the information the learner must see and act on.
- Success signals that can be observed without claiming product-market fit.
- Explicit non-goals that keep OpenLearn from becoming an undefined general-purpose education platform.
- Documented assumptions and open product questions.
- A prioritized handoff to architecture and technology decisions.

## Workstreams

- **Problem framing:** Identify the learner and maintainer pain points, desired outcomes, and evidence needed to validate them.
- **Journey mapping:** Describe first-run, returning-user, and failure or interruption journeys.
- **Scope definition:** Separate the minimum lovable product from later personalization, integrations, and operational capabilities.
- **Success measurement:** Define observable signals for comprehension, plan usefulness, progress visibility, and maintainability.

## Dependencies

- [Phase 0: Repository foundation](phase-00-repository-foundation.md).
- Direct product input from prospective learners, maintainers, and contributors.
- The truthful early-stage scope in the [repository README](../../README.md).

## Risks and decisions

- **Risk:** Scope expands into a general-purpose education platform. **Decision:** Record explicit non-goals and require new capabilities to map to the initial learner problem.
- **Risk:** Technical preferences determine the product before user journeys are understood. **Decision:** Keep product outcomes and open questions framework-neutral.
- **Risk:** Success signals measure implementation activity rather than learner value. **Decision:** Tie each signal to a learner or maintainer outcome that can be observed.
- **Risk:** AI or MCP capabilities are treated as the product rather than as means to a learner outcome. **Decision:** Define the learner experience first and make integrations subordinate to it.

## Exit criteria

- A reviewed product brief exists.
- The primary learner and maintainer problems are stated clearly.
- Initial first-run and returning-user journeys are agreed.
- The minimum lovable product and first dashboard experience are bounded.
- Explicit non-goals, assumptions, open questions, and measurable success signals are recorded.
- A prioritized handoff is ready for Phase 2.

## Next phase

[Phase 2: Architecture and technology decisions](phase-02-architecture-decisions.md) selects the technical boundaries needed to support the agreed product scope.
