# OpenLearn beta baseline

## Included

- Authenticated, owner-scoped dashboard reads and progress actions.
- Provider-neutral OIDC/OAuth JWT verification and explicit principal mapping.
- PostgreSQL persistence for plans, operations, mutation markers,
  personalization, and deletion tombstones.
- Fenced operation recovery, maintenance reconciliation, and retention sweep.
- Connected dashboard mode with CSRF protection, safe CORS, rate-limit headers,
  and server-side deletion.
- Portable service/dashboard images, local Compose topology, migration command,
  CI verification, and operational runbooks.

## Beta boundaries

- The connected AI client still owns chat, prompt interpretation, and plan
  generation. OpenLearn validates plan-shaped input; it does not ship a model
  provider or store raw conversations.
- The repository supplies a provider-neutral identity verifier and session
  helpers. The selected deployment must provide the OIDC login/callback or a
  trusted identity gateway.
- The supplied containers are portable artifacts, not a vendor-specific
  production deployment. Operators must complete the stable checklist for TLS,
  backups, legal/privacy review, and real provider configuration.
- Personalization controls remain available in the static preview; the hosted
  dashboard API currently exposes plan reads, progress, and deletion. Hosted
  personalization endpoints are a follow-up increment.
