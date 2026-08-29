# Phase 10: Beta, deployment, operations, and community release

## Status

Planned

## Objective

Prepare OpenLearn for controlled beta usage, reliable operations, contributor onboarding, and the first stable public release.

## Why this phase matters

Release readiness includes more than shipping application code. Maintainers need a reproducible deployment path, clear ownership, recovery procedures, support routes, feedback loops, and communication that match the product's actual capabilities.

## Deliverables

- CI/CD workflow and release gates appropriate to the selected architecture.
- Environment management and configuration expectations.
- Database or other persistence migration procedures when the architecture requires them.
- Observability, alerting, and privacy-aware operational signals.
- Deployment, rollback, recovery, and incident runbooks.
- Release notes and communication for the beta and first stable release.
- Contributor onboarding that explains local setup, validation, support, and decision records.
- A controlled beta feedback process with prioritized findings.
- Operational ownership for support, incidents, releases, and recovery.
- A first stable public-release checklist.

## Workstreams

- **Delivery automation:** Make build, test, deployment, and release gates reproducible.
- **Environment and data operations:** Define configuration, secrets, migrations, backups, rollback, and recovery responsibilities.
- **Observability and support:** Provide useful signals, escalation paths, runbooks, and privacy-aware diagnostics.
- **Beta learning:** Invite controlled usage, collect structured feedback, and prioritize changes against the product brief.
- **Community release:** Prepare contributor onboarding, release notes, support expectations, and the stable-release checklist.

## Dependencies

- [Phase 1: Product discovery and scope](phase-01-product-discovery.md) and its success signals and non-goals.
- [Phase 2: Architecture and technology decisions](phase-02-architecture-decisions.md) and its deployment and persistence boundaries.
- [Phase 9: Quality, security, accessibility, and performance](phase-09-quality-security-accessibility-and-performance.md) and its release-quality evidence.
- The repository's [contribution guide](../../CONTRIBUTING.md), [security policy](../../SECURITY.md), and [support guidance](../../SUPPORT.md).

## Risks and decisions

- **Risk:** Deployment differs between environments or cannot be reproduced. **Decision:** Document environment, configuration, migration, and release procedures and verify them from a clean context.
- **Risk:** No one owns recovery, support, or incident decisions. **Decision:** Assign operational ownership before beta usage.
- **Risk:** Beta feedback is unstructured or disconnected from the product scope. **Decision:** Use a controlled feedback process tied to the product brief and success signals.
- **Risk:** Release communication overstates available capabilities. **Decision:** Align release notes, onboarding, support, and public documentation with verified behavior.

## Exit criteria

- A reproducible build, test, and deployment path exists.
- Environment, configuration, persistence, migration, rollback, and recovery procedures are documented and exercised.
- Monitoring, alerting, support, and incident runbooks have identified owners.
- Beta feedback has been collected, reviewed, and translated into prioritized release decisions.
- Contributor onboarding and release communication are ready.
- The first stable public-release checklist is complete and the release scope is explicit.

## Next phase

This is the final phase in the current roadmap. After its exit criteria are satisfied, maintainers should open a reviewed follow-up roadmap for the next product cycle rather than silently extending this sequence.
