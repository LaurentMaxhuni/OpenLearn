# OpenLearn Dashboard Redesign and ChatGPT Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current generic dashboard presentation with a focused learning workspace and make the existing MCP/service boundary ready for ChatGPT developer-mode connection and hosted deployment.

**Architecture:** Preserve the domain, application, route, and view-model boundaries. Evolve `packages/ui` as the presentation owner, strengthen the MCP server metadata and service OAuth discovery at their existing adapters, and document a container-based deployment that keeps `/api/*` and `/mcp` on the service origin.

**Tech Stack:** TypeScript, React 19, Vite, native CSS variables, Fastify 5, official MCP TypeScript SDK, Zod, PostgreSQL adapter, pnpm workspace, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-11-openlearn-dashboard-redesign-and-chatgpt-connector-design.md`

## Global Constraints

- Preserve `/plans` and `/plans/:planId`, primary navigation labels, callbacks, and existing domain/application contracts.
- Keep external plan content untrusted; do not add prompt interpretation, anonymous production access, or caller-controlled redirects.
- Keep `openlearn.create_plan_view`, `openlearn.get_plan_view`, and `openlearn.apply_progress_action` backward compatible.
- Use one cool-neutral palette and one brand accent; use semantic state colors only for state.
- Keep automatic motion at `MOTION_INTENSITY: 3` and honor `prefers-reduced-motion`.
- Keep the dashboard responsive below 768px and preserve visible keyboard focus.
- Do not commit credentials or populated `.env` files.

## File map

- Modify `packages/ui/src/components.tsx` for the shell, page header, and hierarchy-preserving markup.
- Modify `packages/ui/styles.css` for the token system, responsive layout, states, and focus treatment.
- Modify `apps/dashboard/src/app.css` for dashboard-only notices and footer utility styling.
- Modify `apps/dashboard/src/app.tsx` only where static-preview utilities or page composition need to move without changing behavior.
- Modify `packages/mcp/src/server.ts` and `packages/mcp/src/contracts.ts` for tool metadata and auth hints.
- Modify `apps/service/src/index.ts` for MCP auth discovery/challenges and route-safe configuration.
- Modify `apps/service/src/entrypoint.ts` and `.env.example` only for explicit hosted MCP metadata configuration.
- Add focused tests under `packages/mcp/test` and `apps/service/test` before their production changes.
- Modify `docs/operations/DEPLOYMENT.md`, `docs/operations/CONFIGURATION.md`, `apps/service/README.md`, and `packages/mcp/README.md` with the verified deployment and connector path.

### Task 1: Establish the failing connector metadata and auth tests

**Files:**
- Create: `packages/mcp/test/metadata.test.ts`
- Create: `apps/service/test/mcp-auth-discovery.test.ts`
- Modify: `packages/mcp/test/server.test.ts`

**Interfaces:**
- Consumes: existing `createMcpServer`, `createService`, `ServiceConfig`, `MCP_TOOL_NAMES`, and deterministic test dependencies.
- Produces: executable expectations for tool auth metadata, protected-resource discovery, and safe unauthorized challenges.

- [ ] **Step 1: Write the failing MCP metadata test**

Assert that a `plan:read` actor's `openlearn.get_plan_view` registration exposes a read-only annotation, an output schema, and a per-tool `securitySchemes` declaration; assert that a write tool advertises the required scope without leaking learner data.

- [ ] **Step 2: Run the focused MCP test and confirm the expected failure**

Run: `pnpm --filter @openlearn/mcp test`

Expected: FAIL because the current registration has no per-tool auth metadata.

- [ ] **Step 3: Write the failing service discovery test**

Assert that a hosted-configured service returns JSON from `/.well-known/oauth-protected-resource` with the configured MCP resource and authorization server, and that an unauthenticated `/mcp` request returns `401` with a `WWW-Authenticate` header pointing to that metadata URL.

- [ ] **Step 4: Run the focused service test and confirm the expected failure**

Run: `pnpm --filter @openlearn/service test`

Expected: FAIL because the current service has no discovery route or challenge header.

### Task 2: Implement the connector metadata and hosted auth discovery

**Files:**
- Modify: `packages/mcp/src/contracts.ts`
- Modify: `packages/mcp/src/server.ts`
- Modify: `apps/service/src/index.ts`
- Modify: `apps/service/src/entrypoint.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: the tests from Task 1 and the existing actor scopes.
- Produces: stable MCP tool metadata, `mcpResourceOrigin` configuration, protected-resource metadata, and safe `401` challenges.

- [ ] **Step 1: Add the minimal metadata types and environment setting**

Add an optional service `mcpResourceOrigin` and `mcpAuthorizationServer` value. Derive the resource from the hosted public MCP origin, never from a request header. Validate both as controlled HTTPS origins/URLs in preview and production.

- [ ] **Step 2: Add per-tool metadata**

Add `securitySchemes` for `oauth2` with the exact required scopes to each registered tool. Keep `get_plan_view` read-only and idempotent; keep mutation annotations idempotent and non-destructive. Preserve the existing tool names and schemas.

- [ ] **Step 3: Add protected-resource discovery**

Register `GET /.well-known/oauth-protected-resource` only when hosted MCP metadata is configured. Return the canonical resource, authorization server list, and supported scopes. Do not include plan data or secrets.

- [ ] **Step 4: Add the unauthorized challenge**

When `/mcp` authentication fails and hosted metadata is configured, set `WWW-Authenticate: Bearer resource_metadata="<resource metadata URL>"` before returning the existing safe `401` JSON envelope. Keep invalid Origin rejection ahead of auth.

- [ ] **Step 5: Run the focused tests and verify green**

Run: `pnpm --filter @openlearn/mcp test; pnpm --filter @openlearn/service test`

Expected: PASS with the new metadata and challenge assertions.

### Task 3: Add presentation contract tests before the visual pass

**Files:**
- Create: `apps/dashboard/test/design-contract.test.ts`
- Modify: `scripts/quality-gates.mjs` only if an existing source gate needs a stable selector exception.

**Interfaces:**
- Consumes: the current dashboard source and UI stylesheet.
- Produces: regression checks for route labels, accessible status text, no em-dash visible copy, and the presence of the new layout hooks.

- [ ] **Step 1: Write failing source-level contract assertions**

Read the source files as text and assert that the redesigned shell exposes the named `data-layout` hooks, that the static preview utility is not presented as a learner status banner, and that visible dashboard copy contains no em-dash or en-dash separators.

- [ ] **Step 2: Run the focused dashboard test and confirm failure**

Run: `pnpm --filter @openlearn/dashboard test`

Expected: FAIL because the current markup and visible copy still use the old hooks and dash separators.

### Task 4: Implement the OpenLearn visual redesign

**Files:**
- Modify: `packages/ui/src/components.tsx`
- Modify: `packages/ui/styles.css`
- Modify: `apps/dashboard/src/app.tsx`
- Modify: `apps/dashboard/src/app.css`

**Interfaces:**
- Consumes: the existing UI view-model props and callbacks. No domain or API imports are added.
- Produces: the workbench hierarchy described in the spec with unchanged behavior.

- [ ] **Step 1: Update the shell and page header markup**

Add stable layout hooks and semantic grouping for the compact header, page header, trust state, next action, outline, focused item, and utility preview control. Keep link destinations and callback signatures unchanged.

- [ ] **Step 2: Replace the visual token layer**

Replace the pale blue/Inter-first token set with the documented canvas, surface, ink, muted, border, and cobalt action values. Use the documented 14px surface, 8px control, and pill state shape rule. Remove decorative repeated eyebrow use while retaining state labels that carry meaning.

- [ ] **Step 3: Recompose plans and detail layouts**

Style the plan collection as a featured next-action row followed by a sparse plan list. Style the detail view as a next-action focus surface followed by the outline rail and selected item content. Use explicit one-column mobile collapse rules and avoid introducing a fake create-plan button.

- [ ] **Step 4: Implement complete states and accessibility details**

Keep loading skeletons, empty states, recovery actions, semantic alert/status roles, `:focus-visible`, `:active`, and reduced-motion fallbacks. Remove all visible em-dash/en-dash separators from UI copy.

- [ ] **Step 5: Run the dashboard focused tests and build**

Run: `pnpm --filter @openlearn/dashboard test; pnpm --filter @openlearn/dashboard build`

Expected: PASS, with the generated bundle staying within `apps/dashboard/performance-budget.json`.

### Task 5: Verify local connected service and deployment contract

**Files:**
- Modify: `docs/operations/DEPLOYMENT.md`
- Modify: `docs/operations/CONFIGURATION.md`
- Modify: `apps/service/README.md`
- Modify: `packages/mcp/README.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: the verified service routes, MCP metadata behavior, Dockerfiles, Compose topology, and official OpenAI connector guidance.
- Produces: a concrete deployment and ChatGPT developer-mode runbook with no invented provider credentials.

- [ ] **Step 1: Document the exact local smoke-test sequence**

Include `pnpm install --frozen-lockfile`, package build, Compose startup, migration, `/health/live`, `/health/ready`, MCP Inspector, and dashboard checks.

- [ ] **Step 2: Document the hosted routing and secret boundary**

State that TLS ingress routes `/api/*` and `/mcp` to the service, the dashboard uses connected mode, PostgreSQL remains private, and no secret may be placed in `VITE_*` variables.

- [ ] **Step 3: Document ChatGPT developer-mode connection**

Explain that the user enables Developer mode, adds the public MCP URL including `/mcp`, reviews discovered tools, and runs direct, indirect, follow-up, write, and unsupported prompts. Distinguish developer-mode tunnels from the public HTTPS endpoint needed for a published plugin.

- [ ] **Step 4: Document the remaining provider-specific values**

List the OIDC issuer, JWKS URL, audiences, session secret, database URL, metrics token, public dashboard origin, public MCP resource origin, and authorization server metadata as the only inputs still required for hosted user-specific behavior.

### Task 6: Run full verification and review the visual result

**Files:**
- No source changes expected unless verification finds a regression.

**Interfaces:**
- Consumes: all changes from Tasks 1 through 5.
- Produces: fresh evidence for the final handoff.

- [ ] **Step 1: Run the complete repository verification**

Run: `pnpm run verify`

Expected: exit code 0 with lint, typecheck, tests, build, and release checks passing.

- [ ] **Step 2: Start the dashboard preview and inspect both routes**

Run: `pnpm --filter @openlearn/dashboard dev -- --host 127.0.0.1`

Open `/plans` and `/plans/static-plan-foundations`, inspect desktop and narrow mobile widths, and exercise preview states, outline selection, progress action, recovery action, and keyboard focus.

- [ ] **Step 3: Run the MCP Inspector checks**

Run the service with deterministic local configuration, connect the Inspector to `/mcp`, initialize, inspect metadata, call each tool with valid and invalid inputs, and confirm unauthorized requests fail safely.

- [ ] **Step 4: Review the final diff and secrets**

Run: `git diff --check; git status --short`

Confirm no populated environment file, credentials, generated build output, or unrelated user changes are included.

