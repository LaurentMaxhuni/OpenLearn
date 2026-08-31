# Phase 5 Application Shell and Static Dashboard Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a small, navigable React/Vite dashboard that renders the Phase 4 domain contract through reusable presentation components and deterministic fixtures.

**Architecture:** `apps/dashboard` is the standalone React/Vite host. `packages/ui` owns presentation-only view-model types, semantic components, and CSS tokens; it does not import the domain package or future transport concerns. The dashboard maps `@openlearn/domain` snapshots into UI view models and uses browser history only for local static navigation.

**Tech Stack:** pnpm workspace, strict TypeScript, React 19, Vite 7, CSS custom properties, and Node's built-in `node:test` for pure view-model contract tests.

**Spec:** `docs/phases/phase-05-application-shell-and-static-dashboard.md` and `docs/superpowers/specs/2026-08-30-openlearn-phase-3-dashboard-ux-design.md`

## Global Constraints

- Keep the dashboard deterministic; do not add auth, persistence, service routes, MCP, AI, provider SDKs, or network calls.
- Keep domain state meaning in `@openlearn/domain`; UI receives explicit view models and emits intents only.
- Preserve the Phase 3 order: trust, goal/context, progress, next action, outline, focused item, resources.
- Support a 320 CSS-pixel minimum, keyboard navigation, visible focus, semantic landmarks, live status text, and reduced motion.
- Render resource labels and safe HTTPS links as data; never render model-supplied HTML, scripts, styles, or components.

---

### Task 1: Scaffold the dashboard and UI workspace packages

**Files:**
- Create: `apps/dashboard/package.json`, `apps/dashboard/index.html`, `apps/dashboard/vite.config.ts`, `apps/dashboard/tsconfig.json`, `apps/dashboard/tsconfig.test.json`, `apps/dashboard/src/env.d.ts`
- Create: `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/tsconfig.build.json`
- Modify: `package.json`, `pnpm-lock.yaml`

- [x] Add the React/Vite workspace manifests, scripts, and workspace dependencies.
- [x] Add package compiler settings for JSX, DOM types, declarations, and strict checking.
- [x] Run `pnpm install --lockfile-only` and confirm the lockfile contains only the dashboard/UI toolchain additions.

### Task 2: Define and test the domain-to-UI view-model boundary

**Files:**
- Create: `apps/dashboard/src/view-model.ts`
- Create: `apps/dashboard/test/view-model.test.ts`
- Create: `apps/dashboard/src/seed-data.ts`

- [x] Write tests for canonical order, progress labels, deterministic next action, partial diagnostics, completed-item undo action, and safe plan references.
- [x] Run the focused dashboard test and observe the expected missing-module failure.
- [x] Implement explicit list/detail view models and mapping from `AcceptedPlanSnapshot` without importing domain runtime code into `packages/ui`.
- [x] Add deterministic fixture states for accepted, partial, completed-progress, empty, loading, invalid, retryable, and pending presentations.
- [x] Run the focused test until all view-model assertions pass.

### Task 3: Build the reusable presentation component surface

**Files:**
- Create: `packages/ui/src/models.ts`, `packages/ui/src/components.tsx`, `packages/ui/src/index.ts`, `packages/ui/styles.css`

- [x] Define reusable view-model props and intent callbacks for shell, collection, trust, goal/context, progress, next action, outline, item detail, resources, recovery, loading, and data controls.
- [x] Implement semantic named components with the required text states, nested list structure, completed/undo labels, non-modal delete disclosure focus behavior, and live regions.
- [x] Implement CSS custom properties and responsive layout rules for compact, medium, and wide widths with visible focus and reduced-motion handling.
- [x] Build the UI package and confirm its declarations contain no domain, database, auth, MCP, provider, or network imports.

### Task 4: Compose the static dashboard shell and routes

**Files:**
- Create: `apps/dashboard/src/main.tsx`, `apps/dashboard/src/app.tsx`, `apps/dashboard/src/app.css`

- [x] Add the skip link, header/navigation, main landmark, fixture preview control, and browser-history navigation for `/plans` and `/plans/:planId`.
- [x] Compose list and detail pages in the Phase 3 reading order using only mapped deterministic fixtures.
- [x] Render loading, empty, invalid, retryable, pending, partial, and completed-progress states without claiming live integration.
- [x] Wire local selection, progress intent, delete confirmation, and safe recovery controls as static in-memory demonstrations.

### Task 5: Verify the Phase 5 handoff

**Files:**
- Modify: `docs/phases/phase-05-application-shell-and-static-dashboard.md`, `docs/ROADMAP.md`, `README.md`
- Modify: this plan

- [x] Run `pnpm run verify` and confirm typecheck, tests, and production build pass.
- [x] Run the dashboard build and inspect the generated page for the expected shell entry point.
- [x] Run whitespace, marker, and forbidden-dependency scans over the Phase 5 changes.
- [x] Review responsive/accessibility markup against the Phase 3 acceptance criteria and record any environmental limitations.
- [x] Mark Phase 5 complete only when all exit criteria are evidenced; leave Phase 6 planned.
- [ ] Commit and push the completed Phase 5 branch after verification; commit locally now, with push awaiting explicit authorization.
