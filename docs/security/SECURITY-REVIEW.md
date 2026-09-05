# OpenLearn Phase 9 security review

**Review date:** 2026-09-05
**Status:** Complete for the local implementation; standard scan evidence is recorded below with its coverage limitation.
**Review owner:** OpenLearn maintainers

## Reviewed controls

- MCP inputs now have bounded identifier, timestamp, idempotency-key, string, array, and object-key sizes.
- Fastify rejects request bodies above 512 KiB before authentication or application work.
- Service responses set `Cache-Control: no-store`, a restrictive JSON CSP, `frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, and `X-Content-Type-Options: nosniff`.
- Origin validation runs before HTTP authentication; authentication exceptions fail closed; MCP construction occurs only after an actor is resolved.
- Application and domain tests cover capability short-circuiting, owner/plan scoping, stale revisions, idempotency, cancellation, recovery, deletion, consent withdrawal, and personalization CAS conflicts.
- Product source is checked for executable HTML sinks, dynamic code execution, and native process execution.
- The dashboard renders React text and validated HTTPS resources; no raw HTML injection API is present.

## Findings and dispositions

| ID | Severity | Disposition | Owner | Evidence |
| --- | --- | --- | --- | --- |
| OL-SEC-001 | Informational | Accepted limitation: browser-local storage is not a hosted trust boundary | Dashboard/application maintainers | `docs/security/THREAT-MODEL.md`, progress and personalization adapter tests |
| OL-SEC-002 | Informational | Deferred: production issuer/audience validation and PostgreSQL transaction implementation | Service/persistence maintainers | `docs/ARCHITECTURE.md`, `apps/service/src/index.ts` |
| OL-SEC-003 | Informational | Deferred: deployment ingress rate limits, TLS, and concrete security headers for the static host | Operations maintainers | `docs/phases/phase-10-beta-deployment-operations-and-community-release.md` |

No source-backed high or critical finding is accepted by this record.

## Standard scan evidence

The standard Codex Security scan `344794a1-8901-4e64-84c8-28664b9058e4` was sealed with zero reportable findings across six recorded surfaces. Its canonical report is:

```text
C:\Users\PC\AppData\Local\Temp\codex-security-scans-uwiRVe\OpenLearn\1c56b03c30014934b4eda8f79796d0292d1e390f_20260905T180221Z_v2sbnhed\report.md
```

The result is recorded as partial coverage rather than an independent clean certification: TAC advisory status was `not_granted`; two focused delegated reviewers returned an account usage-limit error; and the baseline reviewer did not return before being closed. The scan also warned that the working tree changed after its original snapshot. The final raw MCP response-header fix and documentation updates were separately covered by the local full verification run. No delegated finding was accepted, and no formal penetration-test or production certification is claimed.

## Verification commands

```text
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
git diff --check
```

The current codebase has no production database, identity provider, live AI provider, or hosted ingress. Their security properties are therefore recorded as deferred contracts rather than inferred from local tests.
