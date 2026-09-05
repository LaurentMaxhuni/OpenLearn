# OpenLearn Phase 9 Quality, Security, Accessibility, and Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish repeatable local quality gates for the implemented OpenLearn domain, application, MCP, service, dashboard, and personalization slices, with evidence-backed security, privacy, accessibility, performance, and resilience checks.

**Architecture:** Keep release gates dependency-free and outside product packages so they can run before the optional production adapters exist. Harden the existing service and MCP boundaries in their owning packages, keep learner-state invariants in domain/application tests, and record limitations explicitly where production authentication, PostgreSQL, live AI, and deployment headers are not present.

**Tech Stack:** TypeScript 5.9, Node.js 24, pnpm 10, Node built-in test runner, React 19, Vite 7, Fastify 5, MCP TypeScript SDK, Markdown evidence records, and a dependency-free Node quality-gate script.

**Spec:** `docs/phases/phase-09-quality-security-accessibility-and-performance.md`, with existing Phase 2, Phase 3, Phase 4, Phase 6, Phase 7, and Phase 8 contracts as prerequisites.

## Global Constraints

- Preserve the existing owner, capability, revision, progress, consent, deletion, and no-automatic-plan-mutation invariants.
- Treat MCP input, generated plan content, browser storage, and learner feedback as untrusted data.
- Do not persist or emit raw prompts, bearer tokens, authorization codes, raw feedback, full plan payloads, or hidden provider state.
- Keep production persistence, authentication, live AI, and deployment configuration behind explicit adapters; Phase 9 may verify their contracts but must not fake their availability.
- Use a 512 KiB maximum MCP request body, bounded protocol strings, explicit security response headers, and a 350 KiB uncompressed dashboard JavaScript budget.
- Use `pnpm`; run verification with the bundled Node 24 runtime when the host default is outside the repository engine range.
- Update the Phase 9 handoff documents whenever a gate becomes verified, deferred, or blocked.

---

### Task 1: Add the repeatable quality-gate runner and performance budget

**Files:**
- Create: `scripts/quality-gates.mjs`
- Create: `apps/dashboard/performance-budget.json`
- Modify: `package.json`
- Modify: `apps/dashboard/package.json`
- Test: `scripts/quality-gates.test.mjs`

**Interfaces:**
- Consumes: repository source, package manifests, `apps/dashboard/performance-budget.json`, and `apps/dashboard/dist` after a production build.
- Produces: `pnpm run lint` source-gate results and a failed dashboard build when JavaScript or CSS exceeds the checked budget.

- [x] **Step 1: Write failing gate tests**

Create Node built-in tests that exercise source checks against temporary fixtures: reject executable HTML sinks, reject missing focus/reduced-motion markers, accept the repository's current safe source, and reject a synthetic bundle over the configured byte budget.

- [x] **Step 2: Run the focused gate tests and observe the missing runner failure**

Run `node --test scripts/quality-gates.test.mjs`.

Expected result: the test command fails because `scripts/quality-gates.mjs` and the budget file do not exist yet.

- [x] **Step 3: Implement the dependency-free gates**

Implement `runSourceGates(root)` and `runBundleGates(root)` in `scripts/quality-gates.mjs`. The source gate must inspect only current product source and enforce the absence of `dangerouslySetInnerHTML`, `.innerHTML`, `eval(`, `new Function(`, and `child_process` in production source; require the UI focus and reduced-motion markers; require the service security-header helper and MCP request bound; and verify the root package scripts expose `lint`, `typecheck`, `test`, `build`, and `verify`. The bundle gate must sum `.js` and `.css` files below `apps/dashboard/dist/assets`, compare them with `performance-budget.json`, and print measured bytes before throwing a non-zero failure.

Use this budget document:

```json
{
  "javascriptBytes": 358400,
  "stylesheetBytes": 102400,
  "totalBytes": 460800
}
```

Expose the CLI as `node scripts/quality-gates.mjs source` and `node scripts/quality-gates.mjs bundle`.

- [x] **Step 4: Wire the gates into package scripts**

Add root `lint` and make `verify` run `lint` before typechecking, tests, and builds. Make the dashboard `build` run the bundle gate after `vite build` so both filtered and recursive builds enforce the same budget.

- [x] **Step 5: Run focused tests and source gates**

Run `node --test scripts/quality-gates.test.mjs` and `pnpm run lint` with Node 24. Expected result: all focused gate tests and repository source gates pass.

---

### Task 2: Harden the MCP and HTTP service trust boundaries

**Files:**
- Modify: `packages/mcp/src/contracts.ts`
- Modify: `packages/mcp/test/server.test.ts`
- Modify: `apps/service/src/index.ts`
- Modify: `apps/service/test/service.test.ts`
- Create: `apps/service/src/security.ts`
- Test: `apps/service/test/security.test.ts`

**Interfaces:**
- Consumes: `ServiceConfig`, MCP schemas, Fastify request/response hooks, and the existing explicit authenticators.
- Produces: bounded MCP inputs, `MCP_MAX_REQUEST_BYTES`, `securityHeaders`, and tested fail-closed service behavior.

- [x] **Step 1: Add failing security-boundary tests**

Test that overlong idempotency keys and candidate requests are rejected by the MCP schemas, the service exposes `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Content-Security-Policy`, and `frame-ancestors` headers on health and MCP responses, oversized HTTP bodies are rejected before authentication/application work, and an unallowed Origin still receives a safe 403 without invoking authentication.

- [x] **Step 2: Implement bounded protocol schemas**

Add explicit maximum lengths for idempotency keys, timestamps, and identifiers while preserving the current identifier grammar. Export `MCP_MAX_REQUEST_BYTES = 512 * 1024` and use it as the service Fastify `bodyLimit`.

- [x] **Step 3: Implement reusable service security headers**

Create `securityHeaders(reply)` that sets only static headers safe for the current service boundary. Register an `onSend` hook so every response, including health, origin, authentication, and MCP failures, receives the headers. Set `Content-Security-Policy` to `default-src 'none'; frame-ancestors 'none'; base-uri 'none'` for the JSON service and retain JSON content types from the existing handlers.

- [x] **Step 4: Preserve fail-closed request ordering**

Construct Fastify with the bounded body limit, keep Origin validation before authentication, keep authentication before MCP server creation, and keep exception responses generic. Do not log authorization headers or request bodies.

- [x] **Step 5: Run service and MCP tests**

Run `pnpm --filter @openlearn/mcp test` and `pnpm --filter @openlearn/service test`. Expected result: existing contract tests plus new boundary tests pass.

---

### Task 3: Add threat-model, privacy, and retention evidence

**Files:**
- Create: `docs/security/THREAT-MODEL.md`
- Create: `docs/security/SECURITY-REVIEW.md`
- Create: `docs/privacy/PRIVACY-REVIEW.md`
- Create: `docs/quality/PHASE-9-QUALITY-GATE.md`
- Modify: `docs/README.md`
- Test: `scripts/quality-gates.test.mjs`

**Interfaces:**
- Consumes: Phase 2 architecture boundaries, Phase 4 validation, Phase 6 application/MCP lifecycle, Phase 7 progress, Phase 8 personalization, and the source-gate measurements.
- Produces: reviewable threat, privacy, retention, limitation, and release-gate records with owners and evidence links.

- [x] **Step 1: Write the threat model**

Document assets, trust boundaries, attacker capabilities, abuse cases, existing controls, residual risk, and verification evidence for browser storage, dashboard rendering, MCP transport, HTTP authentication, application capabilities, accepted plan validation, progress/personalization state, deletion, and telemetry. State that no production identity provider or PostgreSQL adapter exists in this repository.

- [x] **Step 2: Write the privacy review**

Record the allowed data categories, prohibited data categories, consent/pause/revoke behavior, correction/deletion behavior, Phase 2 retention windows, browser-local storage limitations, telemetry minimization, and the requirement for a deployment-specific review before production.

- [x] **Step 3: Write the security review**

Record the source-backed controls, the standard scan result or its exact environment limitation, unresolved production adapter risks, and a severity/owner/disposition table. Do not claim formal certification or complete deployment security.

- [x] **Step 4: Add the repeatable quality-gate record**

Create a dated, command-oriented record with sections for typecheck, unit/contract/journey tests, source security gates, security review, privacy review, accessibility evidence, performance budget, resilience evidence, and known limitations. Use `Verified`, `Not run`, and `Deferred` states rather than implying success from an unrun command.

- [x] **Step 5: Link the evidence from the documentation index**

Add the Phase 9 evidence records to `docs/README.md` without exposing internal workflow notes as product documentation.

---

### Task 4: Improve accessibility semantics and add journey-level coverage

**Files:**
- Modify: `packages/ui/src/components.tsx`
- Modify: `packages/ui/src/models.ts`
- Modify: `packages/ui/styles.css`
- Modify: `apps/dashboard/src/view-model.ts`
- Create: `apps/dashboard/test/phase9-journey.test.ts`
- Modify: `apps/dashboard/test/view-model.test.ts`

**Interfaces:**
- Consumes: presentation-only view models and existing React components.
- Produces: stable unique IDs, explicit focus targets, accessible state announcements, keyboard-safe disclosure behavior, and deterministic learner journey assertions.

- [x] **Step 1: Add failing semantic and journey tests**

Added journey-level assertions for route/conflict recovery, accepted-plan preservation, progress with disabled personalization, and control/proposal labels. Duplicate-ID and narrow-width behavior were also checked against the rendered production preview.

- [x] **Step 2: Fix reusable ID generation and focus targets**

Add a deterministic ID factory based on a component namespace plus sanitized resource identity and position. Use it for progress status, empty/recovery headings, outline content, personalization controls, and the delete disclosure so multiple mounted instances cannot collide. Pass a focused item heading ID through the model when select-item scroll/focus occurs.

- [x] **Step 3: Improve dynamic status semantics**

Keep learner-facing status text persistent and polite, use `role="alert"` only for blocking recovery errors, associate correction selectors with their feedback records, and give the personalization form an explicit group/name without hiding visible labels. Preserve native buttons/selects and the existing reduced-motion behavior.

- [x] **Step 4: Add high-contrast and reflow safeguards**

Ensure the focus ring remains visible on buttons, links, selects, and disclosure controls; keep text at the existing readable base size; add overflow-safe styles for long bounded labels; and add a reduced-motion rule for all transitions/animations introduced by Phase 9.

- [x] **Step 5: Run dashboard/UI tests and perform a keyboard inspection**

Dashboard and UI checks passed. The production preview was inspected with keyboard-only navigation at a 507px viewport / 492px document width; the observed path and the unavailable screen-reader audit are recorded in `docs/quality/PHASE-9-QUALITY-GATE.md`.

---

### Task 5: Add resilience, contract, and performance evidence

**Files:**
- Create: `apps/service/test/phase9-resilience.test.ts`
- Create: `packages/mcp/test/phase9-contract.test.ts`
- Create: `packages/application/test/phase9-resilience.test.ts`
- Modify: `packages/domain/test/retention.test.ts`
- Modify: `packages/application/test/personalization.test.ts`
- Modify: `docs/quality/PHASE-9-QUALITY-GATE.md`

**Interfaces:**
- Consumes: existing deterministic fixtures, application memory state, MCP schemas/envelopes, Fastify service composition, and retention constants.
- Produces: automated evidence for supported learner journeys, boundary contracts, stale/retry/timeout behavior, deletion/purge metadata, and bundle budget measurements.

- [x] **Step 1: Add application resilience tests**

Cover missing capability short-circuiting, storage read/write failure mapping, stale operation replay, cancellation before commit, uncertain response recovery, personalization CAS conflicts, and the invariant that failed or conflicted mutations preserve the accepted plan and confirmed progress.

- [x] **Step 2: Add MCP contract tests**

Validate strict input rejection, capability-filtered tool discovery, stable output envelope shape, redacted safe errors, and rejection of unsupported/oversized protocol fields.

- [x] **Step 3: Add service resilience tests**

Exercise readiness failures, authenticator exceptions, origin failures, generic MCP failures, and response-header coverage without asserting access to raw credentials or payloads.

- [x] **Step 4: Confirm privacy retention tests**

Assert immediate logical deletion, primary purge within 24 hours, backup expiry at 35 days, redacted telemetry at 30 days, audit metadata at 90 days, personalization feedback deletion, and no raw feedback in telemetry contracts.

- [x] **Step 5: Build and measure the dashboard**

The production build measured 288,680 JavaScript bytes, 18,051 CSS bytes, and 306,731 total bytes against the configured 358,400 / 102,400 / 460,800-byte budgets. Chrome DevTools MCP was unavailable, so Core Web Vitals remain explicitly deferred.

---

### Task 6: Run the full gate, scan the current repository, and update the handoff

**Files:**
- Modify: `docs/phases/phase-06-mcp-integration-and-ai-orchestration.md`
- Modify: `docs/phases/phase-07-interactive-learning-and-progress.md`
- Modify: `docs/phases/phase-08-personalization-and-learner-feedback.md`
- Modify: `docs/phases/phase-09-quality-security-accessibility-and-performance.md`
- Modify: `docs/ROADMAP.md`
- Modify: `README.md`
- Modify: `docs/quality/PHASE-9-QUALITY-GATE.md`
- Modify: `docs/security/SECURITY-REVIEW.md`

- [x] **Step 1: Run all checks with Node 24**

`pnpm install --frozen-lockfile` and `pnpm run verify` passed with the bundled Node 24 runtime. The lockfile was unchanged; generated `dist-test` output is removed during final cleanup.

- [x] **Step 2: Run one standard repository security scan**

Standard scan `344794a1-8901-4e64-84c8-28664b9058e4` was sealed with zero reportable findings across six recorded surfaces. Partial delegated coverage, `not_granted` TAC status, and the working-tree snapshot warning are recorded in the security and quality evidence; no clean certification is claimed.

- [x] **Step 3: Review the final diff and evidence**

The final review used `git diff --check`, source safety gates, targeted trust-boundary inspection, duplicate-ID/overflow checks, and the sealed scan report. Handoff claims are paired with command evidence or explicit limitations.

- [x] **Step 4: Synchronize phase statuses**

Phase 6, Phase 7, and Phase 8 are marked `Local slice` because hosted adapters remain deferred; Phase 9 is marked `Complete (local verification)`; Phase 10 is `Next`. The roadmap, phase files, architecture notes, root README, and package/dashboard handoffs were synchronized.

- [x] **Step 5: Leave the handoff current**

`docs/quality/PHASE-9-QUALITY-GATE.md` records the final commands, results, measurements, security disposition, manual accessibility path, browser-tool limitation, and exact next work. Final branch and working-tree state are reported with the handoff.
