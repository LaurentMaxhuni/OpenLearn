# OpenLearn project roadmap

This roadmap describes the sequence from the current repository foundation to a released AI-assisted learning dashboard. It is a planning document, not a claim that planned dashboard, AI, MCP, personalization, or deployment capabilities are already available.

## Status legend

- `Complete` means the phase exit criteria are satisfied.
- `Next` means the phase is the current focus.
- `Planned` means the phase is later in the sequence and its prerequisites are not complete.

## Phase sequence

| Phase | Status | Outcome | Details |
| --- | --- | --- | --- |
| 0. Repository foundation | Complete | MIT-licensed repository and community baseline | [Details](phases/phase-00-repository-foundation.md) |
| 1. Product discovery and scope | Complete | Bounded learner experience, maintainer boundary, and minimum lovable product | [Details](phases/phase-01-product-discovery.md) |
| 2. Architecture and technology decisions | Complete | Recorded dashboard, service, persistence, identity, and MCP boundaries | [Details](phases/phase-02-architecture-decisions.md) |
| 3. Design system and dashboard UX | Complete | Responsive, accessible visual language and dashboard states | [Details](phases/phase-03-design-system-and-dashboard-ux.md) |
| 4. Learning-plan domain model | Complete | Validated canonical plan contract | [Details](phases/phase-04-learning-plan-domain-model.md) |
| 5. Application shell and static dashboard | Next | Navigable dashboard using deterministic seeded data | [Details](phases/phase-05-application-shell-and-static-dashboard.md) |
| 6. MCP integration and AI orchestration | Planned | Validated, observable boundary for AI-generated plans | [Details](phases/phase-06-mcp-integration-and-ai-orchestration.md) |
| 7. Interactive learning experience and progress | Planned | Persistent learner actions and meaningful progress state | [Details](phases/phase-07-interactive-learning-and-progress.md) |
| 8. Personalization and learner feedback | Planned | Consent-aware plan adjustments and feedback loops | [Details](phases/phase-08-personalization-and-learner-feedback.md) |
| 9. Quality, security, accessibility, and performance | Planned | Verified quality, safety, accessibility, and performance gates | [Details](phases/phase-09-quality-security-accessibility-and-performance.md) |
| 10. Beta, deployment, operations, and community release | Planned | Operationally ready beta and first stable public release | [Details](phases/phase-10-beta-deployment-operations-and-community-release.md) |

## How to use this roadmap

Start with the phase marked `Next`. Use its exit criteria to decide when the work is complete, then use its `Next phase` section to prepare the following handoff. The detailed phase documents contain the deliverables, workstreams, dependencies, risks, decisions, and reviewable completion checks for each stage.

The [documentation index](README.md) is the public entry point. The repository [README](../README.md) explains the current project direction and early-stage scope.

## Phase dependencies

The sequence is intentionally ordered so that each later capability has a stable input:

1. The repository foundation enables product discovery.
2. Product discovery bounds the architecture and technology decisions.
3. Architecture decisions and product journeys inform the design system and dashboard UX.
4. The UX contract and architecture boundaries inform the learning-plan domain model.
5. The domain model and UX contract inform the application shell and static dashboard.
6. The static dashboard and domain contract provide the target for MCP integration and AI orchestration.
7. Validated plan ingestion enables interactive learning and persisted progress.
8. Meaningful progress state enables consent-aware personalization and learner feedback.
9. The complete learner experience is the subject of quality, security, accessibility, and performance verification.
10. Verified quality and operational boundaries enable beta, deployment, operations, and community release.

## Maintenance rules

- Keep the phase order and statuses in this file synchronized with the detailed phase files.
- Keep roadmap summaries concise; the phase files are the source of detail.
- Change a phase status only after its exit criteria are reviewed and satisfied.
- Keep future capabilities in future-oriented language until their relevant phase is complete.
- Record consequential architecture and product changes in the phase documentation that owns the decision.
- Use dependencies and statuses instead of calendar promises.
