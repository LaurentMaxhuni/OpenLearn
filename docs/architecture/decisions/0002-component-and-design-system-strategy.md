# ADR-0002: Component and design-system strategy

**Status:** Accepted

## Context

OpenLearn's value is a set of pre-made learning-plan components and a dashboard that composes them into a useful learner view. The first supported host is the OpenLearn dashboard itself. Components must remain reusable and provider-neutral without pretending that the project already has a public package API or a completed visual system.

## Decision

Build a first-party React component package in `packages/ui`. The dashboard consumes those components through explicit UI view models or component props. A component must not receive a database row, an MCP request object, a bearer token, or a provider-specific response as its public input.

Use semantic HTML, keyboard-accessible interactions, and CSS custom properties for the design-token layer. The token names and values, responsive rules, focus behavior, motion policy, and complete state matrix are Phase 3 deliverables. The component package owns presentation composition; domain and application packages own state meaning and transitions.

The initial component inventory follows the Phase 1 dashboard: goal/context, progress summary, next action, plan outline, focused plan item, learner progress action, and trust/recovery state. Each component must define at least its normal, loading, empty, partial, invalid, error, disabled, focus, and completed behavior where that state applies.

Use Vite's library build capability only when the package needs a distributable build. Until an external consumer exists, the package is a workspace dependency of the dashboard rather than a separately published product. React remains an explicit peer boundary for future distribution.

## Alternatives considered

### Third-party component or design-system kit

An external kit could shorten the first implementation, but its interaction and styling assumptions would become the product's visual contract. It could also make the most important trust, progress, and recovery states look like generic application chrome.

### Web Components as the first public surface

Web Components would maximize host-framework reach, but they would add a cross-framework distribution and styling contract before OpenLearn has validated a second host. React is the selected first host and lets the team test the component model with less ceremony.

### Components local to the dashboard application

Keeping all components in `apps/dashboard` would be fast for a single screen, but it would make the reusable-component promise implicit and encourage the dashboard to own domain or integration details. The package boundary makes reuse and ownership reviewable from the start.

## Consequences

Positive consequences:

- The dashboard is a reference consumer of an explicit component surface.
- Component props remain stable when MCP transport or persistence changes.
- CSS custom properties leave room for theming without choosing a visual vendor.
- Accessibility and state behavior become component acceptance criteria rather than later cleanup.

Costs and constraints:

- Phase 3 must define tokens and state behavior before the package can be considered complete.
- A React package is not yet framework-neutral for external consumers.
- View-model mapping adds a small presentation boundary between application results and components.
- Component fixtures and interaction tests are required to prevent state drift.

## Revisit conditions

Revisit this decision when a second host framework is a committed product requirement, when the UI package needs independent versioning, or when the Phase 3 review finds that the first-party primitives cannot meet the required accessibility or responsive behavior.

## References

- [React TypeScript guidance](https://react.dev/learn/typescript)
- [Vite library mode](https://vite.dev/guide/build.html#library-mode)
