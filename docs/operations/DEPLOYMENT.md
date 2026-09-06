# Deployment runbook

This is the provider-neutral deployment sequence for a beta environment.
Replace registry, networking, secret-manager, and service-manager commands
with the equivalent commands for the selected host.

## 1. Verify the release candidate

Run from a clean checkout with Node 24 and pnpm 10:

```powershell
pnpm install --frozen-lockfile
pnpm run verify
pnpm run release:check
```

The CI workflow repeats these commands and builds both OCI images. It does not
push an image or deploy infrastructure automatically.

## 2. Build the images

Build immutable images from the same commit:

```powershell
docker build -f Dockerfile.service -t openlearn/service:<commit> .
docker build -f Dockerfile.dashboard `
  --build-arg VITE_OPENLEARN_MODE=connected `
  -t openlearn/dashboard:<commit> .
```

Scan and push the images through the chosen registry, then deploy by digest or
the immutable commit tag. The connected dashboard keeps API traffic on its
origin, so the TLS edge must route `/api/*` to the service and `/mcp` to the
service. The database is private.

## 3. Prepare the database

Create a database and secret-scoped role, then run the migration exactly once
before starting the new service revision:

```powershell
$env:OPENLEARN_DATABASE_URL = '<secret connection string>'
$env:OPENLEARN_ENVIRONMENT = 'preview'
pnpm --filter @openlearn/service build
pnpm --filter @openlearn/service migrate
```

For a container-only host, run `node apps/service/dist/migrate.js` from the
service image with the same runtime environment. Migrations are forward-only;
do not edit an applied migration or reset a hosted database to recover from an
application rollback.

## 4. Configure and roll out the service

Inject the values in [Configuration](CONFIGURATION.md), including the exact
dashboard origin, allowed origin list, database URL, OIDC issuer/JWKS/audience,
session secret, and production metrics token. Set `OPENLEARN_TRUST_PROXY=true`
only when the service is reachable solely through a trusted ingress that
rewrites forwarding headers.

Start the service image and wait for:

```text
GET /health/live  -> 200 {"status":"ok"}
GET /health/ready -> 200 {"status":"ok"}
```

Readiness checks PostgreSQL. A 503 readiness response is a rollout failure,
not a reason to send traffic to the instance.

## 5. Configure identity and the dashboard

Register the browser callback and MCP resource with the selected identity
authority. Provision the test learner's `(issuer, subject)` mapping, then
exercise both the session cookie path and a bearer token with the intended
scopes. The repository verifies credentials but does not pretend to implement
a provider-specific authorization-code callback.

Deploy the dashboard image behind TLS. Confirm that `/plans` is served in
connected mode, `/api/csrf` returns a token only for an allowed origin, and a
same-owner plan can be listed, opened, progressed, and deleted. Confirm that a
different owner receives a non-disclosing unavailable result.

## 6. Smoke test and handoff

Record the commit/image digests, migration result, identity configuration
version, database backup identifier, health responses, and metrics scrape
result in the release record. Keep the previous service and dashboard image
available until the smoke test and first monitoring window pass. Use
[Recovery](RECOVERY.md) for rollback or uncertain mutation outcomes.
