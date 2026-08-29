# Phase 2: Architecture and technology decisions

## Status

Planned

## Objective

Select and record the technical boundaries that can support the agreed product scope without coupling the dashboard to a single external provider or unvalidated AI output.

## Why this phase matters

The later implementation phases need shared decisions about the web application, persistence, deployment, authentication, and MCP boundary. Recording those decisions before implementation reduces rework and makes ownership visible.

## Deliverables

- A selected web stack and package-management approach.
- A component and design-system approach aligned with the product and UX constraints.
- A persistence boundary that distinguishes durable domain state from transient integration state.
- A deployment target and environment boundary.
- Authentication assumptions and the identity information the product is allowed to use.
- An MCP connection model with explicit trust and authorization boundaries.
- Small architecture decision records for consequential choices.
- A written boundary map between UI, domain logic, persistence, and AI/MCP integration.
- Local development and verification expectations that do not depend on undocumented machine state.

## Workstreams

- **Technology selection:** Compare viable web, component, package, persistence, and deployment choices against the product brief.
- **Boundary design:** Define the contracts between presentation, domain, storage, authentication, and external integrations.
- **MCP connection model:** Decide how capabilities are discovered, authorized, invoked, timed out, and observed.
- **Decision records:** Capture the reason, alternatives, consequences, and revisit conditions for each consequential choice.

## Dependencies

- [Phase 1: Product discovery and scope](phase-01-product-discovery.md) and its reviewed product brief.
- The first-run and returning-user journeys.
- The minimum lovable product and its non-goals.

## Risks and decisions

- **Risk:** A stack is chosen because it is familiar rather than because it serves the product boundary. **Decision:** Evaluate choices against the reviewed product brief and explicit constraints.
- **Risk:** UI, domain, persistence, and integration responsibilities become coupled. **Decision:** Maintain written boundaries and contracts before implementation.
- **Risk:** MCP authorization or provider assumptions leak into unrelated application code. **Decision:** Isolate the connection model behind a reviewed boundary.
- **Risk:** Decision records become too broad to review. **Decision:** Keep each record focused on one consequential choice and its trade-offs.

## Exit criteria

- The relevant web, package, component, persistence, deployment, authentication, and MCP choices are reviewed.
- Architecture decision records explain the selected options, alternatives, and consequences.
- A boundary diagram or equivalent written boundary map is available.
- Local development and verification expectations are documented.
- Phase 3 has clear inputs for its design-system and dashboard UX work.

## Next phase

[Phase 3: Design system and dashboard UX](phase-03-design-system-and-dashboard-ux.md) turns the product journeys and selected boundaries into a reviewable visual and interaction contract.
