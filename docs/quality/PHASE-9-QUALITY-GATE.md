# OpenLearn Phase 9 quality-gate record

**Review date:** 2026-09-05
**Status:** Complete for the local implementation; hosted adapter gates remain deferred to Phase 10.
**Scope:** Current `main` tree after the Phase 9 implementation work.

## Gate status

| Gate | Status | Evidence / limitation |
| --- | --- | --- |
| Frozen dependency install | Verified | `pnpm install --frozen-lockfile` passed with pnpm 10.15.0 |
| Source safety and repository scripts | Verified | `node --test scripts/quality-gates.test.mjs` (3/3); `pnpm run lint` |
| Clean workspace package typecheck | Verified | `pnpm run typecheck` bootstraps package declarations before recursive checks |
| Unit, contract, journey, and resilience tests | Verified | `pnpm run verify` passed: domain 77, application 20, dashboard 28, MCP 5, service 10; UI typecheck passed |
| Phase 9 journey/resilience tests | Verified | Dashboard journey/state tests, application storage/telemetry tests, MCP safe-error tests, and service readiness/header tests passed in the full run |
| MCP/service trust-boundary tests | Verified | `@openlearn/mcp` and `@openlearn/service` tests cover bounds, origin, auth order, and headers |
| Threat model | Verified | `docs/security/THREAT-MODEL.md` |
| Privacy and retention review | Verified for local slice | `docs/privacy/PRIVACY-REVIEW.md`; production purge sink remains deferred |
| Accessibility source contract | Verified | Focus-visible, reduced-motion, document language, native controls, and live-region markers are checked |
| Keyboard/narrow reflow inspection | Verified (manual) | At 507px viewport / 492px document width: skip link, route and item focus, action/status announcements, disclosure controls, resource links, visible focus ring, no duplicate IDs, and no horizontal overflow |
| Dashboard bundle budget | Verified | JavaScript 288,680 bytes; CSS 18,051 bytes; total 306,731 bytes against 358,400 / 102,400 / 460,800-byte limits |
| Core Web Vitals | Deferred | Chrome DevTools MCP is not available in this host; no LCP/INP/CLS values are claimed |
| Standard repository security scan | Verified with limitation | Scan `344794a1-8901-4e64-84c8-28664b9058e4` sealed with 0 reportable findings across 6 reviewed surfaces; coverage is partial because delegated reviewers were unavailable and the scan snapshot predates the final working-tree edits |
| Production identity, PostgreSQL, live AI, and ingress | Deferred | Not implemented in this repository; Phase 10 owns deployment readiness |

## Repeatable commands

Run with Node 24 and pnpm:

```text
pnpm install --frozen-lockfile
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
git diff --check
```

The root `verify` script runs the same gates in order. The package typecheck bootstrap is intentional: a clean install has no pre-existing `dist` declaration files for workspace imports. The final run used the bundled Node 24 runtime and did not modify the lockfile.

## Manual accessibility path

The production dashboard preview was inspected at `http://127.0.0.1:4173/plans` and the plan detail route with keyboard input. The observed path was: skip link -> plans navigation -> plan card -> detail route -> back link -> next item -> progress action -> outline disclosure -> item selection -> resource link -> personalization enable/disable/status -> feedback controls. Route changes moved focus to the main landmark; selected items exposed a focus target; status changes moved focus to persistent polite status text. A DOM check found no duplicate IDs and no document overflow beyond the 492px viewport width. This was a keyboard/DOM inspection only; a screen-reader audit was not run.

## Security scan evidence

The sealed standard scan is `344794a1-8901-4e64-84c8-28664b9058e4`. Its canonical report was written to:

```text
C:\Users\PC\AppData\Local\Temp\codex-security-scans-uwiRVe\OpenLearn\1c56b03c30014934b4eda8f79796d0292d1e390f_20260905T180221Z_v2sbnhed\report.md
```

The scan found no reportable findings in the six recorded surfaces. TAC advisory status was `not_granted`. Two focused delegated reviewers returned an account usage-limit error, and the baseline reviewer was closed after not returning; this is recorded as deferred coverage, not as a clean independent review. The security scan also warned that the working tree changed while it was running, so the final raw MCP header fix and documentation edits were verified separately by the local test/build gates.

## Release decision rule

Phase 9 is `Complete` for the local implementation because every runnable gate has current evidence and unavailable coverage is explicitly documented. A deferred Core Web Vitals measurement is not a clean performance result; the local bundle budget is the measurable fallback until browser tooling is available. Phase 10 must close the production identity, persistence, provider, telemetry, ingress, rate-limit, and hosted deletion gates before beta use.

## Final handoff

The final handoff is recorded above. Branch state at handoff: `main` tracking `origin/main`; no commit was created. The working tree contains the Phase 9 implementation and evidence changes listed by `git status --short --branch`, intentionally left for maintainer review.
