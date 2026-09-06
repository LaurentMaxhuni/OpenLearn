# Stable release checklist

The checklist must be completed by the named release, data, service, identity,
security/privacy, and community owners before a public learner release.

## Repository and artifacts

- [ ] `pnpm install --frozen-lockfile` succeeds with Node 24.
- [ ] `pnpm run verify` succeeds.
- [ ] `pnpm run release:check` succeeds.
- [ ] CI has verified the commit and built both OCI images.
- [ ] Image digests, source commit, and release notes are recorded.
- [ ] No secrets, populated environment files, or learner data are in the
  image, repository, or browser assets.

## Identity and trust boundaries

- [ ] One canonical HTTPS OIDC issuer is configured for dashboard and MCP.
- [ ] JWKS, audience/resource, scope, callback, and session-cookie behavior are
  tested with a non-production identity.
- [ ] `(issuer, subject)` provisioning and revocation are explicit and
  owner-isolated; no email or provider-account matching is used.
- [ ] Dashboard origin, `/api` routing, `/mcp` routing, CORS, CSRF, and
  trusted-proxy settings are verified at the real edge.
- [ ] Production metrics are private and token-protected.

## Data and recovery

- [ ] Migrations have run successfully on the target database and are recorded.
- [ ] A backup and isolated restore have been exercised.
- [ ] Deletion tombstones are replayed before restored traffic is admitted.
- [ ] Plan deletion hides state immediately and the 24-hour purge job is
  scheduled and observable.
- [ ] Operation reconciliation and retention maintenance run at least every
  five minutes in beta.
- [ ] Backup and account-deletion retention is verified at 35 days.

## Learner and community readiness

- [ ] Connected `/plans` and direct plan handoff work for a test identity.
- [ ] Progress, stale conflict, retry, refresh, and deletion paths are tested.
- [ ] Keyboard/narrow-layout smoke checks and selected browser performance
  measurements are recorded.
- [ ] Support, incident, security, privacy, and ownership contacts are named.
- [ ] Beta feedback intake is open and its data-handling limits are visible.
- [ ] Release notes accurately describe provider-neutral AI ownership and the
  absence of anonymous production share links.

## Decision

Record `approved`, `blocked`, or `approved with explicitly documented
limitations`, with the release owner and timestamp. A local green build is
necessary but does not replace the deployment-specific checks above.
