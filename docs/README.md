# OpenLearn documentation

This directory explains the product direction and contributor-facing delivery sequence for OpenLearn. The project is in an early stage: the learning dashboard, AI orchestration, and MCP integration described here are planned work rather than currently available features.

## Public documentation

Start with the [project roadmap](ROADMAP.md). It gives the complete phase order, current status, expected outcome, and handoff for each stage of the project.

The [Phase 1 product brief](product-brief.md) records the bounded relationship between an external AI client, OpenLearn's reusable components and dashboard, and the learner experience.

The detailed phase documents are listed below:

1. [Phase 0: Repository foundation](phases/phase-00-repository-foundation.md)
2. [Phase 1: Product discovery and scope](phases/phase-01-product-discovery.md)
3. [Phase 2: Architecture and technology decisions](phases/phase-02-architecture-decisions.md)
4. [Phase 3: Design system and dashboard UX](phases/phase-03-design-system-and-dashboard-ux.md)
5. [Phase 4: Learning-plan domain model](phases/phase-04-learning-plan-domain-model.md)
6. [Phase 5: Application shell and static dashboard](phases/phase-05-application-shell-and-static-dashboard.md)
7. [Phase 6: MCP integration and AI orchestration](phases/phase-06-mcp-integration-and-ai-orchestration.md)
8. [Phase 7: Interactive learning and progress](phases/phase-07-interactive-learning-and-progress.md)
9. [Phase 8: Personalization and learner feedback](phases/phase-08-personalization-and-learner-feedback.md)
10. [Phase 9: Quality, security, accessibility, and performance](phases/phase-09-quality-security-accessibility-and-performance.md)
11. [Phase 10: Beta, deployment, operations, and community release](phases/phase-10-beta-deployment-operations-and-community-release.md)

## For contributors

Read the [repository README](../README.md) for the project overview and current scope. Read the [contribution guide](../CONTRIBUTING.md) before opening an issue or pull request. The [GitHub repository](https://github.com/LaurentMaxhuni/OpenLearn) is the place to discuss product direction and implementation work.

## Keeping this documentation truthful

- `Complete` means the phase exit criteria have been satisfied.
- `Next` identifies the current phase that should receive focused work.
- `Planned` identifies work whose prerequisites are not complete.
- Planned capabilities must not be described as available features.
- Phase statuses change only when the phase exit criteria are reviewed and satisfied.
- The roadmap intentionally uses dependencies and statuses instead of calendar promises.

The public documentation describes outcomes and boundaries. Internal workflow records under `docs/superpowers/` are maintained separately and are not part of the public navigation path.
