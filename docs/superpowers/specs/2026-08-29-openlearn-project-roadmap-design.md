# OpenLearn Project Roadmap Documentation Design

**Date:** 2026-08-29
**Status:** Approved for implementation after spec review

## Goal

Create a public documentation map for OpenLearn that explains the complete path from the current repository foundation to a released AI-assisted learning dashboard. The documentation must help a new contributor understand what is being built, why the phases are ordered as they are, what each phase delivers, and how completion is judged.

## Context

OpenLearn currently has a truthful early-stage README and standard open-source community files. The repository also contains internal workflow records under `docs/superpowers`. It needs a separate public-facing documentation layer that describes the product roadmap without exposing internal execution mechanics as the primary user experience or claiming that planned functionality already exists.

## Audience

- prospective users who want to understand the product direction;
- contributors who need to find the next useful area of work;
- maintainers who need a shared sequence for product and technical decisions;
- reviewers who need explicit outcomes and exit criteria for each phase.

## Design principles

1. **Outcome-driven:** Each phase describes the user or engineering outcome it must produce, not just a list of tasks.
2. **Date-free:** The roadmap uses statuses and dependencies instead of calendar promises that will become stale.
3. **Truthful:** Completed work is separated from planned work, and the documents do not present the dashboard, AI orchestration, or MCP integration as implemented.
4. **Framework-neutral until architecture:** The roadmap describes interfaces and decisions before naming a frontend framework, component library, package manager, or MCP SDK.
5. **Reviewable:** Every phase has deliverables, dependencies, risks or decisions, and exit criteria.
6. **One public entry point:** `docs/README.md` explains the documentation hierarchy; `docs/ROADMAP.md` is the sequence overview; the individual phase files hold detail.

## Document structure

Create these public documents:

```text
docs/
├── README.md
├── ROADMAP.md
├── phases/
│   ├── phase-00-repository-foundation.md
│   ├── phase-01-product-discovery.md
│   ├── phase-02-architecture-decisions.md
│   ├── phase-03-design-system-and-dashboard-ux.md
│   ├── phase-04-learning-plan-domain-model.md
│   ├── phase-05-application-shell-and-static-dashboard.md
│   ├── phase-06-mcp-integration-and-ai-orchestration.md
│   ├── phase-07-interactive-learning-and-progress.md
│   ├── phase-08-personalization-and-learner-feedback.md
│   ├── phase-09-quality-security-accessibility-and-performance.md
│   └── phase-10-beta-deployment-operations-and-community-release.md
└── superpowers/
    ├── plans/
    └── specs/
```

The existing `docs/superpowers` tree is preserved. The public index may link to the public roadmap and phase files, but it does not need to advertise internal workflow records.

## Roadmap sequence

### Phase 0: Repository foundation

Status: Complete. Establish the MIT-licensed open-source repository, README positioning, community policies, contribution routes, and GitHub templates. This phase is represented by the existing repository files and should link to the current README and contribution guidance.

### Phase 1: Product discovery and scope

Status: Next. Define the primary learner and maintainer problems, initial user journeys, minimum lovable product, success signals, non-goals, and the first dashboard experience. The output is a bounded product brief that prevents the project from expanding into an undefined general-purpose education platform.

### Phase 2: Architecture and technology decisions

Status: Planned. Select the web stack, package manager, component approach, persistence boundary, deployment target, authentication assumptions, and MCP connection model. Record consequential choices as small architecture decision records and define the boundaries between UI, domain logic, persistence, and AI/MCP integration.

### Phase 3: Design system and dashboard UX

Status: Planned. Define the dashboard information architecture, responsive layouts, design tokens, component states, accessibility requirements, empty/loading/error states, and the visual language for goals, topics, milestones, and progress.

### Phase 4: Learning-plan domain model

Status: Planned. Define the canonical learning-plan schema, validation rules, identifiers, lifecycle states, ordering, progress semantics, versioning, and safe handling of incomplete or invalid AI output. The model becomes the stable contract shared by MCP ingestion, persistence, and dashboard rendering.

### Phase 5: Application shell and static dashboard

Status: Planned. Build the navigable application shell and reusable dashboard components with deterministic seeded data. Establish the page layout, component composition, responsive behavior, routing, and visual states before introducing live AI or external integration complexity.

### Phase 6: MCP integration and AI orchestration

Status: Planned. Implement the selected MCP connection boundary, capability discovery, request lifecycle, authorization, input/output validation, retries, timeouts, error states, and observability. Convert an AI-generated plan into the domain model without trusting model output as already-valid application state.

### Phase 7: Interactive learning experience and progress

Status: Planned. Allow learners to inspect, edit, start, pause, complete, and reorder plan items where the product brief permits. Persist progress, expose meaningful state transitions, and update dashboard visualizations from domain state rather than presentation-only flags.

### Phase 8: Personalization and learner feedback

Status: Planned. Use learner progress and explicit feedback to support plan adjustments, recommendations, pacing, and context-aware next steps. Define consent, explainability, override, and data-retention expectations before adaptive behavior is enabled.

### Phase 9: Quality, security, accessibility, and performance

Status: Planned. Establish automated tests, contract tests for plan data and MCP boundaries, threat modeling, prompt-injection and untrusted-output defenses, privacy review, accessibility verification, performance budgets, and resilient error handling.

### Phase 10: Beta, deployment, operations, and community release

Status: Planned. Prepare CI/CD, environment management, migrations, observability, release notes, deployment runbooks, contributor onboarding, beta feedback, and the first stable public release. Define operational ownership and rollback or recovery procedures before inviting broad usage.

## Phase document contract

Every phase file must use the same headings:

1. `Status` — one of `Complete`, `Next`, or `Planned`.
2. `Objective` — the single outcome the phase exists to achieve.
3. `Why this phase matters` — the dependency or user value it unlocks.
4. `Deliverables` — concrete artifacts or capabilities produced by the phase.
5. `Workstreams` — grouped work areas that can be planned independently.
6. `Dependencies` — earlier phases, decisions, or inputs required before work starts.
7. `Risks and decisions` — known risks and the decisions that must be made within the phase.
8. `Exit criteria` — observable checks that allow maintainers to close the phase.
9. `Next phase` — the specific handoff to the following phase.

Phase 0 should point to existing repository files. Phase 1 should be the only phase marked `Next`; all other phases remain `Planned` until their prerequisites are completed.

## Linking and maintenance rules

- Use relative links for files within `docs/`.
- Use the repository URL `https://github.com/LaurentMaxhuni/OpenLearn` for project-level GitHub links.
- Keep the phase order and status in `docs/ROADMAP.md` synchronized with each phase file.
- Do not duplicate the full contents of a phase file in the roadmap; use a concise summary and link.
- Update a phase’s status only when its exit criteria are satisfied.
- Do not add calendar dates, framework-specific commands, or implementation claims before the relevant phase makes them authoritative.

## Acceptance criteria

The documentation work is ready when:

- `docs/README.md` and `docs/ROADMAP.md` exist;
- all 11 phase files exist with the exact phase order and shared heading contract;
- Phase 0 is marked `Complete`, Phase 1 is marked `Next`, and Phases 2-10 are marked `Planned` in both the roadmap and phase files;
- every phase states its objective, deliverables, dependencies, risks or decisions, exit criteria, and next-phase handoff;
- all local links resolve, and the existing `docs/superpowers` documents remain unchanged;
- no document presents planned dashboard, AI, MCP, personalization, or deployment behavior as currently available;
- no unfinished markers or calendar promises are present;
- Markdown whitespace checks pass.

## Scope boundary

This change creates planning documentation only. It does not choose the application stack, implement UI or MCP code, create CI, add database schemas, or modify the existing open-source repository health files. Those implementation decisions begin in Phase 1 and Phase 2 through their own reviewed designs and plans.
