# Configuration

Configuration is split between runtime service settings and dashboard build
settings. Copy [.env.example](../../.env.example) only as a naming reference;
do not commit a populated `.env` file.

## Runtime service settings

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENLEARN_ENVIRONMENT` | hosted | `local`, `preview`, or `production`; production enables HTTPS/HSTS checks |
| `OPENLEARN_BUILD_VERSION` | no | Version shown in deployment metadata and release diagnostics |
| `OPENLEARN_DASHBOARD_ORIGIN` | yes | Exact browser origin used to build safe dashboard handoffs |
| `OPENLEARN_ALLOWED_ORIGINS` | yes | Comma-separated exact origins accepted for dashboard and MCP requests |
| `OPENLEARN_SERVICE_HOST` / `OPENLEARN_SERVICE_PORT` | no | Bind address and port; use `0.0.0.0` only inside a protected container network |
| `OPENLEARN_TRUST_PROXY` | no | Set `true` only when every forwarding hop is controlled and overwrites forwarding headers |
| `OPENLEARN_DATABASE_URL` | hosted | PostgreSQL connection string; inject as a secret |
| `OPENLEARN_DATABASE_POOL_MAX` | no | Maximum application pool size |
| `OPENLEARN_OIDC_ISSUER` | hosted | Canonical HTTPS issuer shared by dashboard and remote MCP ownership |
| `OPENLEARN_OIDC_JWKS_URL` | hosted | HTTPS JWKS endpoint for remote bearer verification |
| `OPENLEARN_OIDC_AUDIENCE` | hosted | Audience/resource accepted by `/mcp`; for ChatGPT, use the same canonical value as `OPENLEARN_MCP_RESOURCE_ORIGIN` |
| `OPENLEARN_DASHBOARD_AUDIENCE` | hosted | Audience used by the signed dashboard session cookie; defaults to the dashboard origin |
| `OPENLEARN_MCP_RESOURCE_ORIGIN` | ChatGPT OAuth | Canonical public HTTPS resource origin, without the `/mcp` path; configure together with the authorization server |
| `OPENLEARN_MCP_AUTHORIZATION_SERVER` | ChatGPT OAuth | Exact HTTPS issuer base URL published in protected-resource metadata |
| `OPENLEARN_SESSION_SECRET` | hosted | At least 32 random bytes for the session verifier |
| `OPENLEARN_METRICS_PATH` | no | Metrics route; defaults to `/metrics` |
| `OPENLEARN_METRICS_TOKEN` | production | At least 32 characters; required when `OPENLEARN_ENVIRONMENT=production` |
| `OPENLEARN_RATE_LIMIT_MAX` / `OPENLEARN_RATE_LIMIT_WINDOW_MS` | no | Bounded per-instance safety guard; the ingress remains the shared limit |
| `OPENLEARN_RECONCILIATION_LIMIT` | maintenance | Number of expired operation leases handled in one maintenance run, from 1 to 1000 |
| `OPENLEARN_LOCAL_OWNER_ID` / `OPENLEARN_LOCAL_SCOPES` | local only | Development stdio actor; never use for hosted ownership |

The service fails closed when required origins, database, identity, session,
or production metrics settings are absent. The production database pool uses
certificate verification (`rejectUnauthorized=true`).

Dashboard sessions created with the identity package defaults include the
plan, progress, and personalization scopes used by the connected dashboard.
If an identity gateway mints sessions directly, include `personalization:read`
and `personalization:write` to enable the consent and feedback controls; the
application still enforces learner consent and state-version checks.

When the two MCP metadata variables are set, the service publishes
`/.well-known/oauth-protected-resource` and adds a `WWW-Authenticate` discovery
challenge to unauthenticated `/mcp` requests. The configured authorization
server still owns login, callback, PKCE, token issuance, and provider-specific
scope policy. It must return an issuer that exactly matches
`OPENLEARN_MCP_AUTHORIZATION_SERVER` and issue tokens for the configured
resource audience.

## Dashboard build settings

The dashboard defaults to the deterministic static preview during local Vite
development. A deployed dashboard must be built with:

```text
VITE_OPENLEARN_MODE=connected
```

The connected client calls `/api` on the dashboard origin and sends browser
credentials. The supplied Nginx example proxies `/api/` to a service named
`service`; an equivalent ingress can route that path to the service. If a
deployment intentionally uses a separate service origin, set
`VITE_OPENLEARN_SERVICE_ORIGIN` at build time and update the deployed
`connect-src` policy to the exact HTTPS origin.

No server secret, database URL, OIDC client secret, session secret, metrics
token, or bearer token may be placed in a `VITE_*` variable or browser asset.

## Identity provisioning

The first hosted flow requires one identity authority for both session and MCP
tokens. Before a learner can use a plan, provision the verified
`(issuer, subject)` pair through the explicit persistence resolver. Do not
match by email, display name, provider account ID, or equal subject text from a
different issuer. The login/callback or identity gateway owns provider-specific
code exchange and calls the identity helper to create the short-lived signed
session cookie.
