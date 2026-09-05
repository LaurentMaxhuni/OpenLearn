# Phase 9: Quality, security, accessibility, and performance

## Status

Complete (local verification)

## Objective

Establish evidence-based quality, security, accessibility, performance, and resilience gates for the complete OpenLearn experience.

## Implemented and verified (2026-09-05)

- Dependency-free source and bundle gates run through the root `verify` command; the dashboard bundle is 288,680 JavaScript bytes, 18,051 CSS bytes, and 306,731 total bytes against the configured 358,400 / 102,400 / 460,800-byte budgets.
- Domain, application, dashboard, MCP, service, UI compile, journey, resilience, retention, and protocol-contract checks pass under the bundled Node 24 runtime.
- The service has bounded request bodies, strict protocol field limits, fail-closed Origin/authentication ordering, generic errors, and tested security headers on normal and hijacked responses.
- Keyboard and narrow-width inspection covers skip-link navigation, route focus, item focus, progress status, personalization status, disclosure controls, resource links, visible focus rings, no duplicate IDs, and no horizontal overflow.
- Threat, privacy, and retention records are linked from the documentation index. The standard Codex Security scan is recorded as partial with no reportable findings in reviewed surfaces; TAC was not granted and delegated worker coverage was limited by account usage.

This completion applies to the local implementation and explicitly does not certify production identity, PostgreSQL, live AI/provider, telemetry, TLS/ingress, rate-limit, or hosted deletion behavior.

## Why this phase matters

The product handles learner progress, external capabilities, and generated content. Automated checks and focused reviews are needed to catch regressions, unsafe trust assumptions, inaccessible flows, privacy problems, and unacceptable latency before broad usage.

## Deliverables

- Automated unit, integration, and end-to-end tests for supported learner journeys.
- Contract tests for learning-plan data and MCP boundaries.
- Threat model covering application, identity, persistence, external capabilities, and generated content.
- Defenses against prompt injection, untrusted output, unsafe tool use, and authorization errors.
- Privacy review covering learner data, feedback, observability, retention, and deletion.
- Accessibility verification for semantics, keyboard access, focus, contrast, text, motion, and assistive technology.
- Performance budgets and measurements for key learner journeys.
- Resilient error handling and recovery behavior for local and external failures.
- A repeatable quality-gate record that can be used before release decisions.

## Workstreams

- **Automated verification:** Test domain transitions, UI states, integrations, persistence, and learner journeys.
- **Security and trust:** Threat-model external input and enforce validation, authorization, least privilege, and safe side effects.
- **Privacy:** Review collection, use, storage, observability, retention, deletion, and learner control.
- **Accessibility:** Verify the dashboard and interactive flows against the Phase 3 acceptance criteria.
- **Performance and resilience:** Measure critical paths and exercise timeouts, failures, partial results, recovery, and resource limits.

## Dependencies

- [Phase 2: Architecture and technology decisions](phase-02-architecture-decisions.md) and its system boundaries.
- [Phase 4: Learning-plan domain model](phase-04-learning-plan-domain-model.md) and its validation rules.
- [Phase 6: MCP integration and AI orchestration](phase-06-mcp-integration-and-ai-orchestration.md) and its trust boundary.
- [Phase 7: Interactive learning and progress](phase-07-interactive-learning-and-progress.md) and its state transitions.
- [Phase 8: Personalization and learner feedback](phase-08-personalization-and-learner-feedback.md) and its consent and retention rules.

## Risks and decisions

- **Risk:** External-service behavior is insufficiently covered by tests. **Decision:** Use contract tests, controlled failure cases, and explicit integration evidence.
- **Risk:** Prompt injection or untrusted output bypasses application safeguards. **Decision:** Keep validation, authorization, and side-effect controls at the trust boundary.
- **Risk:** A learner flow is technically functional but inaccessible. **Decision:** Treat accessibility verification as a release gate rather than an optional polish step.
- **Risk:** Privacy or retention behavior is undocumented. **Decision:** Require a reviewed privacy record and learner-control evidence.
- **Risk:** Latency, resource use, or provider failures make the experience unreliable. **Decision:** Set measurable performance budgets and exercise resilient failure behavior.

## Exit criteria

- Required automated and contract tests pass for supported journeys and boundaries.
- Threat modeling and security review findings are recorded and resolved or accepted by an identified owner.
- Privacy and retention behavior is reviewed.
- Accessibility evidence covers the dashboard and interactive learner flows.
- Performance evidence meets the agreed budgets for critical paths.
- Failure, timeout, partial-result, and recovery behavior is verified.
- The project has a release-quality record ready for Phase 10 operations and beta work.

## Next phase

[Phase 10: Beta, deployment, operations, and community release](phase-10-beta-deployment-operations-and-community-release.md) prepares the verified product for controlled usage and the first stable public release.
