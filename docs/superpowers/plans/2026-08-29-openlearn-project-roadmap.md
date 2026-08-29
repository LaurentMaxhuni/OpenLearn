# OpenLearn Project Roadmap Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a public, date-free documentation map that explains OpenLearn's path from its current repository foundation to an AI-assisted learning dashboard, with one roadmap overview and eleven reviewable phase documents.

**Architecture:** Add a public documentation layer under `docs/` with `docs/README.md` as the entry point, `docs/ROADMAP.md` as the concise sequence, and one detailed file per phase under `docs/phases/`. Leave the existing `docs/superpowers/` workflow records untouched; they remain internal execution history rather than the public documentation hierarchy.

**Tech Stack:** Markdown files, relative Markdown links, Git, and read-only PowerShell/`rg` validation commands. No application runtime, dependency, framework, database, CI, or MCP SDK is introduced by this change.

**Spec:** `docs/superpowers/specs/2026-08-29-openlearn-project-roadmap-design.md`

## Global Constraints

- **Outcome-driven:** Each phase describes the user or engineering outcome it must produce, not just a list of tasks.
- **Date-free:** The roadmap uses statuses and dependencies instead of calendar promises that will become stale.
- **Truthful:** Completed work is separated from planned work, and the documents do not present the dashboard, AI orchestration, or MCP integration as implemented.
- **Framework-neutral until architecture:** The roadmap describes interfaces and decisions before naming a frontend framework, component library, package manager, or MCP SDK.
- **Reviewable:** Every phase has deliverables, dependencies, risks or decisions, and exit criteria.
- **One public entry point:** `docs/README.md` explains the documentation hierarchy; `docs/ROADMAP.md` is the sequence overview; the individual phase files hold detail.
- Use the exact phase order `00` through `10` and the exact statuses `Complete`, `Next`, and `Planned` defined by the spec.
- Use relative links for files within `docs/`.
- Use `https://github.com/LaurentMaxhuni/OpenLearn` for project-level GitHub links.
- Keep the phase order and status in `docs/ROADMAP.md` synchronized with each phase file.
- Do not duplicate the full contents of a phase file in the roadmap; use a concise summary and link.
- Update a phase's status only when its exit criteria are satisfied.
- Do not add calendar dates, framework-specific commands, or implementation claims before the relevant phase makes them authoritative.
- This change creates planning documentation only. It does not choose the application stack, implement UI or MCP code, create CI, add database schemas, or modify existing open-source repository health files.
- Every phase file uses these headings in this order: `Status`, `Objective`, `Why this phase matters`, `Deliverables`, `Workstreams`, `Dependencies`, `Risks and decisions`, `Exit criteria`, and `Next phase`.

## File Map

Create the following public documentation files:

- `docs/README.md` — explains the public documentation hierarchy and links contributors to the roadmap.
- `docs/ROADMAP.md` — provides the ordered phase table, statuses, concise outcomes, dependencies, and maintenance rules.
- `docs/phases/phase-00-repository-foundation.md` — records the completed repository foundation.
- `docs/phases/phase-01-product-discovery.md` — defines the next product-scoping outcome.
- `docs/phases/phase-02-architecture-decisions.md` — records the future architecture-selection outcome.
- `docs/phases/phase-03-design-system-and-dashboard-ux.md` — defines the future dashboard UX and design-system outcome.
- `docs/phases/phase-04-learning-plan-domain-model.md` — defines the future learning-plan contract.
- `docs/phases/phase-05-application-shell-and-static-dashboard.md` — defines the future deterministic dashboard shell.
- `docs/phases/phase-06-mcp-integration-and-ai-orchestration.md` — defines the future MCP and AI boundary.
- `docs/phases/phase-07-interactive-learning-and-progress.md` — defines the future learner interaction and progress behavior.
- `docs/phases/phase-08-personalization-and-learner-feedback.md` — defines the future personalization and feedback behavior.
- `docs/phases/phase-09-quality-security-accessibility-and-performance.md` — defines the future quality and safety gates.
- `docs/phases/phase-10-beta-deployment-operations-and-community-release.md` — defines the future beta and first-release outcome.

Do not modify any existing file under `docs/superpowers/`, including the approved specification and this plan's sibling workflow records.

---

### Task 1: Add the public documentation index

**Files:**
- Create: `docs/README.md`

**Interfaces:**
- Consumes: the public-docs hierarchy and phase statuses from the approved spec.
- Produces: the stable entry point linking to `ROADMAP.md`, all phase files, the repository README, contribution guidance, and the GitHub repository.

- [ ] **Step 1: Write the index introduction and navigation**

Create a short `# OpenLearn documentation` page that states this folder explains the product direction and contributor-facing delivery sequence. Link `ROADMAP.md` first, then list the phase documents in order from Phase 0 through Phase 10.

- [ ] **Step 2: Add audience and maintenance guidance**

Add sections titled `Public documentation`, `For contributors`, and `Keeping this documentation truthful`. Explain that the roadmap is date-free, planned capabilities are not yet available, and phase status changes require the phase exit criteria. Link to `../README.md`, `../CONTRIBUTING.md`, and `https://github.com/LaurentMaxhuni/OpenLearn`.

- [ ] **Step 3: Review the index links**

Confirm every listed local target exists after the phase files are added, and keep internal `docs/superpowers` records out of the public navigation list.

---

### Task 2: Add the roadmap overview

**Files:**
- Create: `docs/ROADMAP.md`

**Interfaces:**
- Consumes: the eleven phase names, statuses, and summaries in the approved spec.
- Produces: the single concise sequence that links to each detailed phase file without copying its full contents.

- [ ] **Step 1: Write the roadmap purpose and status legend**

Create `# OpenLearn project roadmap` with a short statement that the roadmap describes the sequence from repository foundation to a released AI-assisted learning dashboard. Define `Complete` as the phase's exit criteria being satisfied, `Next` as the current focus, and `Planned` as a later phase whose prerequisites are not yet complete.

- [ ] **Step 2: Add the ordered phase table**

Use one table with columns `Phase`, `Status`, `Outcome`, and `Details`. Add exactly these rows and relative links:

| Phase | Status | Outcome | Details |
| --- | --- | --- | --- |
| 0. Repository foundation | Complete | MIT-licensed repository and community baseline | `phases/phase-00-repository-foundation.md` |
| 1. Product discovery and scope | Next | Bounded learner problem, first journeys, and minimum lovable product | `phases/phase-01-product-discovery.md` |
| 2. Architecture and technology decisions | Planned | Recorded boundaries and technology decisions | `phases/phase-02-architecture-decisions.md` |
| 3. Design system and dashboard UX | Planned | Responsive, accessible visual language and dashboard states | `phases/phase-03-design-system-and-dashboard-ux.md` |
| 4. Learning-plan domain model | Planned | Validated canonical plan contract | `phases/phase-04-learning-plan-domain-model.md` |
| 5. Application shell and static dashboard | Planned | Navigable dashboard using deterministic seeded data | `phases/phase-05-application-shell-and-static-dashboard.md` |
| 6. MCP integration and AI orchestration | Planned | Validated, observable boundary for AI-generated plans | `phases/phase-06-mcp-integration-and-ai-orchestration.md` |
| 7. Interactive learning experience and progress | Planned | Persistent learner actions and meaningful progress state | `phases/phase-07-interactive-learning-and-progress.md` |
| 8. Personalization and learner feedback | Planned | Consent-aware plan adjustments and feedback loops | `phases/phase-08-personalization-and-learner-feedback.md` |
| 9. Quality, security, accessibility, and performance | Planned | Verified quality, safety, accessibility, and performance gates | `phases/phase-09-quality-security-accessibility-and-performance.md` |
| 10. Beta, deployment, operations, and community release | Planned | Operationally ready beta and first stable public release | `phases/phase-10-beta-deployment-operations-and-community-release.md` |

- [ ] **Step 3: Add sequence and maintenance notes**

Add sections titled `How to use this roadmap`, `Phase dependencies`, and `Maintenance rules`. State that Phase 1 is the only current `Next` phase, the later phases depend on decisions and contracts from earlier phases, and statuses must stay synchronized with the phase files. Link back to `README.md` and forward to each phase detail file only through the table.

---

### Task 3: Document repository foundation and product discovery

**Files:**
- Create: `docs/phases/phase-00-repository-foundation.md`
- Create: `docs/phases/phase-01-product-discovery.md`

**Interfaces:**
- Consumes: the existing repository files and the product direction in `README.md`.
- Produces: a completed foundation record and the next bounded product-discovery brief.

- [ ] **Step 1: Write Phase 0 with status `Complete`**

Use all shared headings. Record the objective as establishing a trustworthy, MIT-licensed open-source starting point. Link to `../../README.md`, `../../LICENSE`, `../../CONTRIBUTING.md`, `../../CODE_OF_CONDUCT.md`, `../../SECURITY.md`, `../../SUPPORT.md`, `../../CHANGELOG.md`, and the GitHub issue and pull-request templates. Its exit criteria must state that the repository foundation files exist, the project direction is honestly described as early-stage, and contribution/support/security routes are discoverable. Its next phase is Phase 1 product discovery.

- [ ] **Step 2: Write Phase 1 with status `Next`**

Use all shared headings. Set the objective to produce a bounded product brief for the primary learner and maintainer problems. Cover learner and maintainer personas, first-run and returning-user journeys, the minimum lovable product, the first dashboard experience, success signals, non-goals, assumptions, and open product questions. Make its dependencies Phase 0 and direct product input; identify scope expansion and premature technical commitment as risks. Its exit criteria must require a reviewed product brief, agreed initial journeys, explicit non-goals, measurable success signals, and a prioritized handoff to Phase 2.

- [ ] **Step 3: Check historical claims**

Ensure Phase 0 describes only files that exist in the repository and Phase 1 uses future-oriented language for all dashboard, AI, and MCP capabilities.

---

### Task 4: Document architecture decisions and dashboard UX

**Files:**
- Create: `docs/phases/phase-02-architecture-decisions.md`
- Create: `docs/phases/phase-03-design-system-and-dashboard-ux.md`

**Interfaces:**
- Consumes: Phase 1's product brief and the shared learning-plan direction.
- Produces: decision boundaries for later implementation and a framework-neutral dashboard UX contract.

- [ ] **Step 1: Write Phase 2 with status `Planned`**

Document selection of the web stack, package manager, component approach, persistence boundary, deployment target, authentication assumptions, and MCP connection model. Require small architecture decision records and explicit boundaries between UI, domain logic, persistence, and AI/MCP integration. Identify premature commitment, integration coupling, and unclear ownership as risks. Its exit criteria must require reviewed decisions, a boundary diagram or equivalent written map, local development expectations, and a handoff to Phase 3.

- [ ] **Step 2: Write Phase 3 with status `Planned`**

Document the dashboard information architecture, responsive layout behavior, design tokens, component states, accessibility requirements, and empty/loading/error states for goals, topics, milestones, and progress. Keep all guidance framework-neutral. Identify visual inconsistency, inaccessible interaction states, and presenting untrusted AI output as authoritative as risks. Its exit criteria must require a reviewed UX specification, token and component-state inventory, responsive behavior definition, and accessibility acceptance criteria before Phase 4.

- [ ] **Step 3: Check dependency language**

Make Phase 2 depend on the Phase 1 product brief and make Phase 3 depend on the Phase 1 journeys plus Phase 2's selected boundaries, without claiming that either implementation exists.

---

### Task 5: Document the learning-plan contract and static dashboard

**Files:**
- Create: `docs/phases/phase-04-learning-plan-domain-model.md`
- Create: `docs/phases/phase-05-application-shell-and-static-dashboard.md`

**Interfaces:**
- Consumes: Phase 2 architecture boundaries and Phase 3 UX requirements.
- Produces: the future canonical plan contract and the deterministic UI milestone that precedes live integrations.

- [ ] **Step 1: Write Phase 4 with status `Planned`**

Document the canonical learning-plan schema, validation rules, stable identifiers, lifecycle states, ordering, progress semantics, versioning, and safe handling of incomplete or invalid AI output. State that the model is the contract shared by MCP ingestion, persistence, and dashboard rendering. Identify schema drift, ambiguous progress semantics, invalid model output, and unsafe data acceptance as risks. Its exit criteria must require a reviewed schema, validation examples, lifecycle and version rules, and contract tests or equivalent fixtures specified for Phase 6.

- [ ] **Step 2: Write Phase 5 with status `Planned`**

Document the navigable application shell, reusable dashboard components, deterministic seeded data, page layout, composition, routing, responsive behavior, and visual states. Explicitly state that live AI and external integrations are not part of this phase. Identify layout instability, inaccessible states, and coupling presentation components to future integrations as risks. Its exit criteria must require a usable shell, representative seeded plan states, responsive and state coverage, and a handoff to MCP integration.

- [ ] **Step 3: Check the implementation boundary**

State in both files that Phase 4 defines a contract and Phase 5 renders deterministic data; neither phase claims that MCP, AI generation, persistence, or personalization is available.

---

### Task 6: Document MCP orchestration and interactive progress

**Files:**
- Create: `docs/phases/phase-06-mcp-integration-and-ai-orchestration.md`
- Create: `docs/phases/phase-07-interactive-learning-and-progress.md`

**Interfaces:**
- Consumes: Phase 4's domain contract, Phase 5's dashboard shell, and the MCP boundary selected in Phase 2.
- Produces: the future validated AI/MCP lifecycle and persistent learner interaction model.

- [ ] **Step 1: Write Phase 6 with status `Planned`**

Document the selected MCP connection boundary, capability discovery, request lifecycle, authorization, input/output validation, retries, timeouts, error states, and observability. Require conversion of AI-generated plans into the domain model and explicitly reject treating model output as already-valid application state. Identify prompt injection, untrusted output, authorization leakage, provider failure, retry duplication, and opaque failures as risks. Its exit criteria must require validated boundary contracts, safe failure behavior, observable requests, and an end-to-end plan-ingestion path suitable for Phase 7.

- [ ] **Step 2: Write Phase 7 with status `Planned`**

Document learner actions to inspect, edit, start, pause, complete, and reorder plan items where the product brief permits. Cover persistence, meaningful state transitions, progress semantics, and dashboard updates driven by domain state rather than presentation-only flags. Identify accidental data loss, conflicting updates, unclear completion rules, and progress that cannot be explained to the learner as risks. Its exit criteria must require tested state transitions, persisted progress, editable-plan rules, and updated dashboard visualizations.

- [ ] **Step 3: Check the trust boundary**

Ensure Phase 6 treats MCP and model output as external/untrusted input and Phase 7 treats progress as domain state; neither file should state that the integration or learner experience already exists.

---

### Task 7: Document personalization, quality gates, and release readiness

**Files:**
- Create: `docs/phases/phase-08-personalization-and-learner-feedback.md`
- Create: `docs/phases/phase-09-quality-security-accessibility-and-performance.md`
- Create: `docs/phases/phase-10-beta-deployment-operations-and-community-release.md`

**Interfaces:**
- Consumes: Phase 7 progress state, Phase 2 operational boundaries, and the repository's community guidance.
- Produces: the future consent-aware personalization contract, cross-cutting release gates, and beta/public-release handoff.

- [ ] **Step 1: Write Phase 8 with status `Planned`**

Document plan adjustments, recommendations, pacing, and context-aware next steps based on learner progress and explicit feedback. Require consent, explainability, learner override, and data-retention expectations before enabling adaptive behavior. Identify over-personalization, opaque recommendations, unwanted persistence, sensitive-data exposure, and feedback loops that reduce learner agency as risks. Its exit criteria must require documented consent and retention rules, explainable recommendation behavior, override paths, and feedback evaluation criteria.

- [ ] **Step 2: Write Phase 9 with status `Planned`**

Document automated tests, plan-data and MCP contract tests, threat modeling, prompt-injection and untrusted-output defenses, privacy review, accessibility verification, performance budgets, and resilient error handling. Identify gaps in external-service coverage, regressions, inaccessible flows, privacy violations, and unbounded latency/resource use as risks. Its exit criteria must require passing quality gates, reviewed security/privacy findings, accessibility evidence, performance evidence, and operationally meaningful failure handling.

- [ ] **Step 3: Write Phase 10 with status `Planned`**

Document CI/CD, environment management, migrations, observability, release notes, deployment runbooks, contributor onboarding, beta feedback, and the first stable public release. Require operational ownership and rollback or recovery procedures before broad usage. Identify deployment drift, missing recovery ownership, unclear support routes, insufficient beta feedback, and release communication gaps as risks. Its exit criteria must require a reproducible release path, environment and migration procedures, monitoring and recovery runbooks, beta learnings, contributor onboarding, and an explicit stable-release checklist.

- [ ] **Step 4: Check release language**

Use future-oriented language throughout Phases 8-10. The documents describe requirements for later work and do not claim that personalization, security gates, deployment, beta access, or a stable release is currently available.

---

### Task 8: Validate the documentation set

**Files:**
- Modify: none
- Test: all new files under `docs/`

**Interfaces:**
- Consumes: the complete public documentation layer and the approved spec.
- Produces: evidence that links, statuses, headings, markers, whitespace, and preservation requirements are satisfied.

- [ ] **Step 1: Confirm the required file set**

Run:

```powershell
@(
  'docs/README.md',
  'docs/ROADMAP.md',
  'docs/phases/phase-00-repository-foundation.md',
  'docs/phases/phase-01-product-discovery.md',
  'docs/phases/phase-02-architecture-decisions.md',
  'docs/phases/phase-03-design-system-and-dashboard-ux.md',
  'docs/phases/phase-04-learning-plan-domain-model.md',
  'docs/phases/phase-05-application-shell-and-static-dashboard.md',
  'docs/phases/phase-06-mcp-integration-and-ai-orchestration.md',
  'docs/phases/phase-07-interactive-learning-and-progress.md',
  'docs/phases/phase-08-personalization-and-learner-feedback.md',
  'docs/phases/phase-09-quality-security-accessibility-and-performance.md',
  'docs/phases/phase-10-beta-deployment-operations-and-community-release.md'
) | ForEach-Object { if (-not (Test-Path -LiteralPath $_)) { throw "Missing required file: $_" } }
```

- [ ] **Step 2: Verify phase statuses and headings**

Run:

```powershell
rg -n '^## (Status|Objective|Why this phase matters|Deliverables|Workstreams|Dependencies|Risks and decisions|Exit criteria|Next phase)$' docs/phases
rg -n '^(Complete|Next|Planned)$' docs/phases
```

Confirm Phase 0 is `Complete`, Phase 1 is `Next`, and Phases 2 through 10 are `Planned`, with the same values in `docs/ROADMAP.md`.

- [ ] **Step 3: Check for unfinished markers and calendar promises**

Run:

```powershell
rg -n -i '\b(TODO|TBD|FIXME)\b|202[0-9]-[0-9]{2}-[0-9]{2}|Q[1-4]\b' docs/README.md docs/ROADMAP.md docs/phases
```

Expected result: no output. A phase may describe future work, but it must not use unfinished-marker language or calendar commitments.

- [ ] **Step 4: Verify local links and preservation**

Inspect every relative link in the new public documents and resolve it from the linking file's directory. Compare the existing `docs/superpowers` files against the pre-change file list and confirm they were not edited. Run `git diff --check` to catch Markdown whitespace errors.

- [ ] **Step 5: Review the final diff for truthfulness**

Run `git status --short` and `git diff -- docs`. Confirm the diff contains only the new public roadmap files, contains no application code or stack choice, and does not describe planned dashboard, AI, MCP, personalization, or deployment behavior as currently available.

---

### Task 9: Commit the roadmap documentation

**Files:**
- Add: `docs/README.md`
- Add: `docs/ROADMAP.md`
- Add: `docs/phases/*.md`

**Interfaces:**
- Consumes: the validated public documentation set.
- Produces: one focused commit containing the roadmap and all phase documents.

- [ ] **Step 1: Stage only the roadmap documentation**

Run:

```powershell
git add docs/README.md docs/ROADMAP.md docs/phases
```

- [ ] **Step 2: Verify the staged file list**

Run:

```powershell
git diff --cached --name-status
```

Expected result: `docs/README.md`, `docs/ROADMAP.md`, and the eleven files under `docs/phases/`; no existing `docs/superpowers` file and no repository health file.

- [ ] **Step 3: Create the focused commit**

Run:

```powershell
git commit -m "docs: add OpenLearn project roadmap"
```

- [ ] **Step 4: Confirm the handoff state**

Run:

```powershell
git status --short --branch
git log -1 --oneline
```

Report the commit identifier, the new documentation entry point, and any validation limitation that could not be checked locally.
