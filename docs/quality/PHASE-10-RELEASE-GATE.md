# OpenLearn Phase 10 release gate

**Review date:** 2026-09-05
**Status:** Complete for the repository's portable beta baseline
**Decision:** The code, CI, connected dashboard, deployment artifacts, runbooks,
and release records are present and verified locally. A real beta still
requires the selected operator to complete provider, database, TLS, backup,
legal, and traffic-specific checks in the stable checklist.

## Gate status

| Gate | Status | Evidence / boundary |
| --- | --- | --- |
| Reproducible dependency install | Verified | `pnpm install --frozen-lockfile` |
| Source, type, test, and build gates | Verified | `pnpm run verify` |
| Release artifact presence and Phase 10 status | Verified | `pnpm run release:check` |
| CI verification and image-build workflow | Verified | `.github/workflows/ci.yml` |
| PostgreSQL migration runner | Verified | `packages/persistence/migrations/001_initial.sql`, `apps/service/src/migrate.ts` |
| Durable operation state, fencing, markers, and retention sweep | Verified by adapter contract and tests | `packages/persistence`, `apps/service/src/maintenance.ts` |
| OIDC/OAuth JWT verification and owner mapping | Verified by focused tests | `packages/identity`, `packages/identity/test/authenticator.test.ts` |
| Authenticated dashboard API, CORS, CSRF, and rate guard | Verified by service tests | `apps/service/test/dashboard-api.test.ts`, `apps/service/test/security.test.ts` |
| Connected dashboard API client and server-side progress/delete path | Verified by dashboard tests/typecheck | `apps/dashboard/src/remote-api.ts`, `apps/dashboard/test/remote-api.test.ts` |
| Redacted metrics and telemetry contract | Verified in source and service composition | `apps/service/src/metrics.ts`, `apps/service/src/telemetry.ts` |
| Deployment images and local Compose topology | Defined and CI-built | `Dockerfile.service`, `Dockerfile.dashboard`, `compose.yaml` |
| Beta feedback, ownership, recovery, and incident records | Verified | `docs/release/`, `docs/operations/` |

## External checks before admitting learners

- Configure and test one real OIDC issuer, JWKS, audience, callback/session
  gateway, principal provisioning path, and key-rotation procedure.
- Run migration, backup/restore, deletion replay, and maintenance tests against
  the selected PostgreSQL service.
- Terminate TLS at the selected ingress, verify `/api` and `/mcp` routing,
  trusted-proxy configuration, shared rate limits, and production headers.
- Run the connected browser smoke path with a non-production test identity and
  measure Core Web Vitals in the selected browser environment.
- Confirm log/metric retention, support contacts, privacy/legal requirements,
  and beta feedback routing.

These are deployment certification steps, not facts inferred from a local
unit-test run.
