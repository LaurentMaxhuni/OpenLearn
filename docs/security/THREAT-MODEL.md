# OpenLearn Phase 9 threat model

**Review date:** 2026-09-05
**Scope:** Current repository implementation, including the domain, application, MCP, Fastify composition, connected/static dashboard paths, PostgreSQL adapter, identity verifier, maintenance job, and browser-local preview stores.
**Owner:** OpenLearn maintainers

This is a source-backed threat model for the repository baseline. It is not a production penetration test, a deployment certification, or a substitute for the configured provider, persistence, backup, and ingress review required before hosting learner data.

## Assets and trust boundaries

| Asset | Confidentiality | Integrity | Current owner |
| --- | --- | --- | --- |
| Accepted plan content and revisions | Learner-scoped | Domain validation and revision fences | Domain/application |
| Learner-confirmed progress | Learner-scoped | Explicit progress transitions and compare-and-set | Domain/application |
| Bounded personalization feedback and proposals | Learner-scoped | Consent, owner/plan scope, lifecycle, and CAS | Domain/application/dashboard adapter |
| Identity and capability context | High | Authentication adapter and application capability checks | Service/application boundary |
| Idempotency and recovery state | Operational | Application lifecycle and durable port contract | Application/persistence adapter |
| Redacted telemetry and audit metadata | Operational | Telemetry contract and retention policy | Application/operations |

The active boundaries are:

1. External MCP JSON and generated plan candidates enter through strict Zod schemas, bounded request bodies, application capability checks, and the Phase 4 domain normalizer.
2. Remote HTTP requests enter Fastify through Origin validation and an explicit HTTP authenticator before an actor-bound MCP server is created.
3. Application use cases receive an internal actor and call domain transitions or explicit ports; they do not accept caller-selected owners or raw credentials.
4. The browser renders only view models and stores minimal owner/plan-scoped progress or personalization records through validating adapters.
5. The selected identity provider, database host, telemetry retention system, ingress, and connected AI client remain external deployment systems even though provider-neutral repository adapters exist.

## Attacker capabilities

The model considers a caller who can submit arbitrary MCP JSON, a caller with an invalid or insufficient capability, a remote browser on an unallowed origin, a stale or replayed mutation, a user who tampers with browser storage, and an external AI response containing misleading or unsafe plan-shaped data. It does not assume access to the host filesystem, the configured identity provider, the database, or deployment secrets.

## Threat and control review

| Threat | Relevant control | Evidence | Residual risk |
| --- | --- | --- | --- |
| Prompt injection or unsafe generated output changes application behavior | Generated content is data; strict MCP schemas and Phase 4 normalization run before accepted state; no code-generation or HTML sink exists in product source | `packages/mcp/src/contracts.ts`, `packages/application/src/use-cases.ts`, `packages/domain/src/normalize.ts`, `scripts/quality-gates.mjs` | Future AI adapters must preserve this path and must never execute model output |
| IDOR or cross-owner access | Actor owner is resolved from verified issuer/subject mapping; application checks capabilities and domain owner/plan scope; missing resources are non-disclosing | `packages/identity/src/authenticator.ts`, `packages/persistence/src/owner-resolver.ts`, `packages/application/src/use-cases.ts` | The selected provider, provisioning workflow, and database deployment still require operator testing |
| Replay, duplicate mutation, or stale worker overwrites state | Required idempotency keys, request fingerprints, leases, fencing, revision/progress versions, and CAS ports | `packages/application/src/lifecycle.ts`, `packages/application/test/lifecycle.test.ts`, domain revision/progress tests | Cross-instance guarantees depend on a real durable adapter |
| Browser XSS or unsafe resource navigation | React escaping, no executable HTML sinks, HTTPS-only canonical resources, CSP deployment contract, and source gate | `packages/domain/src/validation.ts`, `packages/domain/src/normalize.ts`, `packages/ui/src/components.tsx`, `apps/dashboard/index.html` | Same-origin script compromise would expose browser-local records; deploy CSP and dependency controls remain required |
| CSRF or cross-origin MCP use | Controlled Origin allowlist, authenticated dashboard CSRF double-submit, authentication before MCP construction, no anonymous production path, and no caller redirect | `apps/service/src/index.ts`, `apps/service/src/csrf.ts`, `apps/service/test/dashboard-api.test.ts` | The real edge must preserve origin, cookie, and header behavior |
| Request/resource exhaustion | 512 KiB Fastify body limit, bounded protocol strings/collections, domain collection/text limits, dashboard bundle budget, and per-instance rate guard | `packages/mcp/src/contracts.ts`, `apps/service/src/rate-limit.ts`, `packages/domain/src/limits.ts`, `apps/dashboard/performance-budget.json` | Shared ingress rate policy and provider/network timeouts are deployment-specific |
| Sensitive data leakage through errors or telemetry | Generic service/MCP failures, safe application errors, no raw request fields in telemetry, and retention windows | `packages/application/src/contracts.ts`, `packages/application/src/lifecycle.ts`, `docs/privacy/PRIVACY-REVIEW.md` | A production telemetry sink still needs a redaction test against its concrete implementation |
| Tampered browser storage resurrects revoked feedback or progress | Hydration validates owner/plan scope and record shape; stores use versioned keys and compare-and-set; domain revoke/delete transitions remove eligibility | `apps/dashboard/src/progress-store.ts`, `apps/dashboard/src/personalization-store.ts`, corresponding tests | Browser storage is not a durable trust boundary; server-backed adapters are required for hosted use |

## Security objectives

- No unauthenticated or insufficiently scoped path reads or mutates learner state.
- No external content is interpreted as executable markup, code, SQL, or a redirect destination.
- Failed, stale, cancelled, expired, or conflicted work cannot replace the last accepted plan or confirmed progress.
- Consent withdrawal and deletion stop future use immediately and do not resurrect old personalization records.
- Errors, telemetry, and stored integration metadata contain only bounded, redacted operational data.
- Every security claim in the release record points to a test, source gate, or explicit deployment limitation.

## Required follow-up before production

Before production, configure and test one canonical OIDC/OAuth issuer, audience-bound remote MCP tokens, PostgreSQL transactions and migrations, server-side shared rate limits, deployment headers/TLS, backup deletion replay, telemetry retention, and an external AI adapter that re-enters the existing domain validation path. The repository baseline supplies the portable controls; the operator must verify the selected external systems.

## Phase 9 scan note

The standard Codex Security scan `344794a1-8901-4e64-84c8-28664b9058e4` reported zero reportable findings for the six recorded local surfaces. Its coverage remains partial because delegated reviewers were unavailable and the working tree changed after the scan snapshot; the quality and security records preserve those limitations and the canonical report location.
