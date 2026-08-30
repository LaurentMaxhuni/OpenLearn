# OpenLearn Phase 2 Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record the technical boundaries and selected baseline architecture that can support OpenLearn's standalone dashboard, reusable components, durable learner state, and external AI-client capability surface.

**Architecture:** Use a pnpm workspace containing a React and TypeScript dashboard built with Vite, a Node.js and TypeScript service built with Fastify, and shared domain, application, UI, persistence, and MCP adapter packages. Deploy the dashboard and service as separate OCI-compatible units backed by PostgreSQL, with the MCP adapter isolated from the UI and persistence implementations.

**Tech Stack:** Node.js 24 LTS, TypeScript, React, Vite, Fastify, pnpm workspaces, PostgreSQL 18, the official MCP TypeScript SDK, OAuth 2.1-compatible HTTP authorization, stdio for local MCP clients, Streamable HTTP for remote MCP clients, and container-based deployment. No runtime code is introduced by this plan.

**Spec:** `docs/superpowers/specs/2026-08-30-openlearn-architecture-design.md`

## Global Constraints

- Standalone dashboard is the first supported host; public embeddability remains a later extension.
- The connected AI client owns conversation, intent interpretation, and learning-plan content generation or revision.
- OpenLearn owns validation, domain state, reusable components, dashboard rendering, and permitted learner actions.
- External input is untrusted; MCP adapters must call application ports and must not access persistence directly.
- Durable domain state is separated from transient transport and integration state; raw prompts, access tokens, and arbitrary generated markup are not persisted by default.
- The exact canonical plan schema belongs to Phase 4, and exact public MCP tool names and payloads belong to the contract work in Phases 4 and 6.
- The repository is worked on through the existing checkout and the `phase-2-architecture` branch; no linked Git worktree is created.
- The current repository has no runtime or test suite; implementation commands documented here are expectations for the scaffolded project, not claims about current availability.

---

### Task 1: Write the architecture design and boundary map

**Files:**
- Create: `docs/superpowers/specs/2026-08-30-openlearn-architecture-design.md`
- Create: `docs/ARCHITECTURE.md`

**Interfaces:**
- Consumes: `docs/product-brief.md` and `docs/phases/phase-02-architecture-decisions.md`.
- Produces: the accepted architecture baseline, ownership map, package boundaries, data flow, environment model, and Phase 3 handoff.

- [x] **Step 1: Record the selected baseline**

State the standalone-dashboard-first approach and the split dashboard/service deployment. Record the selected TypeScript, React, Vite, Fastify, pnpm, PostgreSQL, MCP SDK, and container decisions, with alternatives and revisit conditions.

- [x] **Step 2: Draw the boundary map**

Show the learner browser, dashboard, HTTP service, MCP adapter, application layer, domain/validation layer, persistence port, PostgreSQL, authentication, and redacted observability as separate responsibilities. State which direction each dependency may flow.

- [x] **Step 3: Define the implementation handoff**

Document the logical workspace layout, local development contract, verification commands expected after scaffolding, environment boundaries, and the decisions deliberately deferred to Phases 3, 4, and 6.

### Task 2: Record stack and component decisions

**Files:**
- Create: `docs/architecture/decisions/0001-application-stack-and-workspace.md`
- Create: `docs/architecture/decisions/0002-component-and-design-system-strategy.md`

**Interfaces:**
- Consumes: the product brief's reusable-component requirement and standalone-first decision.
- Produces: accepted technology and presentation boundaries for the Phase 3 UX and Phase 5 shell work.

- [x] **Step 1: Decide the application stack and workspace layout**

Use a pnpm workspace with `apps/dashboard`, `apps/service`, `packages/ui`, `packages/domain`, `packages/application`, `packages/persistence`, `packages/mcp`, and shared configuration packages as needed. Keep the dashboard and service independently deployable while sharing typed ports and domain packages.

- [x] **Step 2: Decide the component strategy**

Use a first-party React component package with CSS custom-property tokens and accessible semantic primitives. Components accept UI view models or explicit props rather than database records or MCP request objects. Defer token values, full state inventory, and public package distribution rules to Phase 3.

- [x] **Step 3: Document alternatives and consequences**

Compare the selected split TypeScript stack and first-party UI package with a co-hosted full-stack framework, a third-party UI kit, and web components. Record the added service boundary and the benefit of provider-neutral component ownership.

### Task 3: Record state, deployment, identity, and MCP decisions

**Files:**
- Create: `docs/architecture/decisions/0003-persistence-and-state-boundary.md`
- Create: `docs/architecture/decisions/0004-deployment-and-environments.md`
- Create: `docs/architecture/decisions/0005-identity-and-authentication.md`
- Create: `docs/architecture/decisions/0006-mcp-connection-and-trust-boundary.md`

**Interfaces:**
- Consumes: the application boundary from Tasks 1 and 2 and the Phase 1 first-run, returning-user, and failure journeys.
- Produces: accepted persistence, environment, identity, authorization, transport, and trust constraints for later implementation phases.

- [x] **Step 1: Separate durable and transient state**

Choose PostgreSQL as the durable store for plan revisions, learner progress, ownership references, and other accepted domain state. Keep MCP sessions, request lifecycle state, retry metadata, deduplication keys, and token-exchange caches transient or bounded; never use process memory as the only source for state needed across instances.

- [x] **Step 2: Select the deployment and environment model**

Define local, preview, and production environments with isolated configuration and databases. Deploy the dashboard and service as separate OCI-compatible units behind TLS, use a managed PostgreSQL instance for hosted environments, inject secrets at runtime, and keep a worker out of the first deployment unless a later request lifecycle requires one.

- [x] **Step 3: Define identity and authorization**

Use an OIDC-compatible identity boundary for dashboard sessions and OAuth 2.1-compatible authorization for remote MCP requests. Bind ownership to issuer-plus-subject, use plan-scoped permissions, avoid using email or AI-provider identifiers as domain identity, and use environment credentials plus loopback binding for local stdio integrations.

- [x] **Step 4: Define the MCP boundary**

Use the official MCP TypeScript SDK, stdio for client-launched local integrations, and Streamable HTTP for remote integrations. Keep the remote endpoint stateless by default, validate Origin and bearer-token audience, route tool calls through application services, return structured results, reject arbitrary code or markup, and preserve request IDs and redacted lifecycle telemetry.

- [x] **Step 5: Record alternatives and revisit conditions**

Compare PostgreSQL with a document store and browser-only state, container deployment with a co-hosted serverless framework, delegated identity with anonymous links, and MCP with direct HTTP APIs. State what future evidence would justify changing each decision.

### Task 4: Synchronize the public roadmap and phase handoff

**Files:**
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/phases/phase-02-architecture-decisions.md`

**Interfaces:**
- Consumes: the architecture overview and six accepted decision records.
- Produces: a truthful Phase 2 completion state and a direct handoff to Phase 3's UX work.

- [x] **Step 1: Link the architecture documentation**

Add the architecture overview to the public documentation index and link the six decision records from the overview without exposing internal workflow files as the primary navigation.

- [x] **Step 2: Update current-status language**

Keep the dashboard, persistence, and MCP implementation described as planned. Change the repository README's next-design-phase language to point to the Phase 3 design-system and dashboard-UX work.

- [x] **Step 3: Mark Phase 2 complete and Phase 3 next**

Update both the roadmap table and Phase 2 status, deliverables, risks, exit criteria, and next-phase handoff. Leave Phases 3 through 10 planned except for the new Phase 3 `Next` status.

### Task 5: Validate the architecture documentation

**Files:**
- Test: `docs/ARCHITECTURE.md`, `docs/architecture/decisions/*.md`, `docs/superpowers/specs/2026-08-30-openlearn-architecture-design.md`, and synchronized public docs.

**Interfaces:**
- Consumes: all files produced by Tasks 1 through 4.
- Produces: evidence that Phase 2 deliverables are covered, local links resolve, statuses agree, source references are valid, the architecture remains provider-neutral, and no current implementation is falsely claimed.

- [x] **Step 1: Check the Phase 2 deliverables**

Use `rg` and a small PowerShell assertion to verify the selected stack/package approach, component strategy, durable/transient boundary, deployment/environment model, identity assumptions, MCP model, ADR links, boundary map, and local verification contract are all present.

- [x] **Step 2: Resolve public and architecture links**

Resolve every local Markdown link outside code fences in the public documentation and architecture directories. Check that every official external reference uses the intended primary documentation source.

- [x] **Step 3: Scan for contradictions and placeholders**

Scan for unfinished markers, calendar promises, unsupported provider lock-in, arbitrary UI/code execution, and positive claims that the application or MCP integration is already available. Run `git diff --check` and inspect the complete diff.

### Task 6: Commit and publish the Phase 2 branch

**Files:**
- Add: `docs/ARCHITECTURE.md`
- Add: `docs/architecture/decisions/*.md`
- Add: `docs/superpowers/specs/2026-08-30-openlearn-architecture-design.md`
- Add: `docs/superpowers/plans/2026-08-30-openlearn-phase-2-architecture.md`
- Modify: `README.md`, `docs/README.md`, `docs/ROADMAP.md`, and `docs/phases/phase-02-architecture-decisions.md`

**Interfaces:**
- Consumes: the validated Phase 2 architecture set.
- Produces: one focused commit on `phase-2-architecture`, pushed to the matching branch on `origin` for review.

- [x] **Step 1: Stage only Phase 2 documentation**

Stage the architecture overview, six ADRs, internal design and execution records, and synchronized public files. Verify the staged name list contains no application source or unrelated historical document.

- [x] **Step 2: Commit with a focused message**

Create one commit using `docs: define OpenLearn architecture baseline`.

- [x] **Step 3: Push and verify the branch**

Push `phase-2-architecture` to `origin`, then verify the working tree is clean and local HEAD, the tracking branch, and the remote branch point to the same commit.
