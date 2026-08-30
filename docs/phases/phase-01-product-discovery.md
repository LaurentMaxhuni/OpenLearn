# Phase 1: Product discovery and scope

## Status

Complete

## Objective

Produce and review a bounded product brief for the learner experience and maintainer boundary that OpenLearn intends to support first.

## Why this phase matters

OpenLearn is a reusable component and dashboard surface that receives plan-shaped input from an external AI client through an MCP connection. The AI client owns interpreting the learner's request and generating the learning-plan content. OpenLearn needs a clear boundary for validation, state, rendering, and learner actions before technical choices or interface work can be evaluated consistently.

## Deliverables

- A reviewed [product brief](../product-brief.md) defining the learner profile, goals, constraints, context, and expected outcomes.
- A maintainer and contributor profile covering stewardship, support, component quality, and contract responsibilities.
- A first-run journey from an external AI-client submission to a usable learning-plan view.
- A returning-user journey covering plan review, progress inspection, and the next useful action.
- Interruption and failure behavior for incomplete, invalid, duplicated, or unavailable external input.
- A minimum lovable product that names the smallest coherent dashboard and state surface.
- A description of the first dashboard experience, including the information the learner must see and act on.
- Success signals that can be observed without claiming product-market fit.
- Explicit non-goals that keep OpenLearn from becoming an undefined general-purpose education platform or AI conversation product.
- Documented assumptions and open product questions.
- A prioritized handoff to architecture and technology decisions.

## Workstreams

- **Problem framing:** Define the learner's need for a durable, readable, actionable plan view and the maintainer's need for a reusable, provider-neutral boundary.
- **Boundary framing:** Keep conversation, intent interpretation, and curriculum generation with the connected AI client; keep validation, state, components, rendering, and supported learner actions with OpenLearn.
- **Journey mapping:** Describe first-run, returning-user, and recoverable failure or interruption journeys.
- **Scope definition:** Separate the minimum lovable dashboard and progress surface from later personalization, collaboration, provider features, and general education-platform capabilities.
- **Success measurement:** Define observable signals for dashboard usefulness, plan comprehension, progress visibility, state trust, recovery, and maintainability.

## Dependencies

- [Phase 0: Repository foundation](phase-00-repository-foundation.md).
- Direct product input from prospective learners, maintainers, and contributors.
- The truthful early-stage scope in the [repository README](../../README.md).

## Risks and decisions

- **Risk:** Scope expands into a general-purpose education platform or AI chat product. **Decision:** Make OpenLearn's first boundary the reusable dashboard, state, and external capability surface; record explicit non-goals in the [product brief](../product-brief.md).
- **Risk:** OpenLearn is expected to infer user intent or generate curriculum. **Decision:** Treat the connected AI client as the owner of conversation and plan-content generation; OpenLearn receives and validates plan-shaped input.
- **Risk:** Technical preferences determine the product before the boundary and journeys are understood. **Decision:** Keep the brief framework-neutral and leave stack, transport, schema, persistence, identity, and deployment choices to Phase 2 and later owning phases.
- **Risk:** Untrusted or incomplete external content is shown as confirmed learner state. **Decision:** Require explicit pending, accepted, partial, invalid, failed, and learner-confirmed distinctions in the future contract and dashboard.
- **Risk:** Success signals measure implementation activity rather than learner or maintainer value. **Decision:** Tie each signal to dashboard usefulness, progress comprehension, recovery, boundary stability, or contributor supportability.

## Exit criteria

- A reviewed [product brief](../product-brief.md) exists.
- The learner and maintainer problems are stated clearly.
- Initial first-run, returning-user, interruption, and failure journeys are agreed.
- The minimum lovable product and first dashboard experience are bounded.
- Explicit non-goals, assumptions, open questions, and observable success signals are recorded.
- A prioritized handoff is ready for [Phase 2: Architecture and technology decisions](phase-02-architecture-decisions.md).

## Next phase

[Phase 2: Architecture and technology decisions](phase-02-architecture-decisions.md) selects the technical boundaries needed to support the agreed product scope without deciding how the external AI client generates learning content.
