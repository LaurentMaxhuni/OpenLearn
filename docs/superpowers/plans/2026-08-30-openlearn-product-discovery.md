# OpenLearn Product Discovery Documentation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record the bounded OpenLearn product boundary for an AI-facing component and dashboard surface, then hand the agreed scope to Phase 2.

**Architecture:** The product brief treats the connected AI client as the source of user-intent and learning-plan content. OpenLearn receives external tool calls, validates and stores plan-shaped state, and renders reusable dashboard components that learners can inspect and update. The brief stays framework-neutral and leaves transport, schema, persistence, and deployment choices to later phases.

**Tech Stack:** Markdown documentation, relative Markdown links, Git, PowerShell, and `rg` for validation. No application runtime, package manager, framework, database, or MCP SDK is introduced by this change.

**Spec:** `docs/phases/phase-01-product-discovery.md`

## Global Constraints

- OpenLearn owns the reusable components, dashboard surface, tool boundary, validation, persisted state, and learner-facing rendering.
- The connected AI client owns interpreting the learner's request and producing or revising learning-plan content.
- The brief must not choose a web framework, component library, package manager, database, deployment target, authentication model, MCP SDK, or exact tool names.
- Planned dashboard, AI, MCP, persistence, and progress capabilities must remain future-oriented until their roadmap phases are complete.
- The change is documentation-only and must not modify files under `docs/superpowers/specs/` or unrelated repository foundation files.

---

### Task 1: Write the bounded product brief

**Files:**
- Create: `docs/product-brief.md`

**Interfaces:**
- Consumes: `README.md`, `docs/README.md`, `docs/ROADMAP.md`, and the Phase 1 deliverable checklist.
- Produces: the reviewed product boundary used by Phase 2, Phase 3, Phase 4, and Phase 6.

- [x] **Step 1: State the product boundary and roles**

Describe OpenLearn as the reusable component, dashboard, and external-tool surface that turns plan-shaped input into a learner-facing experience. Define the learner and maintainer problems without assigning curriculum design or conversation orchestration to OpenLearn.

- [x] **Step 2: Define the first-run and returning-user journeys**

Document the path from an AI client tool call through validation and rendering to learner review, then describe how a returning learner finds the current plan, understands progress, and takes the next permitted action. Include recoverable invalid, incomplete, interrupted, and failed-input states.

- [x] **Step 3: Bound the minimum lovable product and dashboard**

List the smallest coherent surface: a stable plan-shaped boundary, reusable dashboard components, a first view, learner-readable state, and progress actions allowed by the eventual contract. Name what the initial dashboard must show and what it must not imply.

- [x] **Step 4: Record signals, non-goals, assumptions, and open questions**

Use observable learner and maintainer signals without product-market-fit claims. Exclude curriculum generation, provider ownership, chat orchestration, a general LMS, and later personalization. Record unresolved identity, persistence, revision, tool-surface, embedding, and retention decisions for Phase 2 or later.

### Task 2: Integrate the brief with the roadmap

**Files:**
- Modify: `docs/README.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/phases/phase-01-product-discovery.md`

**Interfaces:**
- Consumes: `docs/product-brief.md`.
- Produces: synchronized documentation navigation, status, exit criteria, and Phase 2 handoff.

- [x] **Step 1: Add the public brief to documentation navigation**

Link `docs/product-brief.md` from the documentation index as the Phase 1 product brief while keeping internal workflow records out of public navigation.

- [x] **Step 2: Mark Phase 1 complete and Phase 2 next**

Update the roadmap and phase files only after the brief covers every Phase 1 deliverable. Keep later phases planned and preserve the distinction between product scope and implementation availability.

- [x] **Step 3: Make the Phase 2 handoff explicit**

Link Phase 2 to the brief and list the boundary, identity, persistence, integration, contract, and validation questions it must resolve without deciding them in Phase 1.

### Task 3: Validate the documentation set

**Files:**
- Test: `docs/product-brief.md`, `docs/README.md`, `docs/ROADMAP.md`, and `docs/phases/phase-01-product-discovery.md`

**Interfaces:**
- Consumes: the edited documentation.
- Produces: evidence that the required brief sections exist, local links resolve, no implementation stack was selected, no unfinished markers were added, and the diff is limited to the requested documentation.

- [x] **Step 1: Check required headings and scope coverage**

Use `rg` to confirm the brief contains learner and maintainer problems, both journeys, minimum lovable product, dashboard experience, success signals, non-goals, assumptions, open questions, and the Phase 2 handoff.

- [x] **Step 2: Resolve local links and truthfulness markers**

Resolve every relative link from its source directory, confirm Phase 1 is `Complete`, Phase 2 is `Next`, and later phases remain `Planned`, then scan for unfinished markers, calendar promises, and claims that planned features are already available.

- [x] **Step 3: Review whitespace and the final diff**

Run `git diff --check`, inspect `git diff -- docs`, and confirm no framework, package, database, provider, or exact MCP tool choice appears in the Phase 1 artifact.

### Task 4: Commit and publish the documentation

**Files:**
- Add: `docs/product-brief.md`
- Modify: `docs/README.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/phases/phase-01-product-discovery.md`

**Interfaces:**
- Consumes: the validated Phase 1 documentation.
- Produces: one focused commit on `main`, published to `origin/main`.

- [x] **Step 1: Stage only the Phase 1 documentation**

Stage the product brief, documentation index, roadmap, and Phase 1 file, then verify the staged name list before committing.

- [x] **Step 2: Commit with a focused message**

Create one commit using `docs: define OpenLearn product brief`.

- [x] **Step 3: Push and verify the published state**

Push `main` to `origin/main`, then verify the working tree, local branch, and upstream commit agree.
