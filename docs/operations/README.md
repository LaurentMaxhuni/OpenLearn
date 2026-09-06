# OpenLearn operations

These runbooks define the portable Phase 10 beta deployment contract. They
assume an OCI-compatible host, a private PostgreSQL 18 instance, one TLS
ingress, and a single configured OIDC/OAuth authority. The repository does not
select a cloud vendor or identity provider.

Read the documents in this order:

1. [Configuration](CONFIGURATION.md)
2. [Deployment](DEPLOYMENT.md)
3. [Recovery](RECOVERY.md)
4. [Observability](OBSERVABILITY.md)
5. [Incidents](INCIDENTS.md)
6. [Ownership](OWNERSHIP.md)

The service image exposes the authenticated learner API and `/mcp`; the
dashboard image serves the connected browser application. The dashboard's
`/api/` path is proxied to the service in the supplied Compose/Nginx example,
or may be routed by an equivalent production ingress. Keep the database and
service off the public network unless the ingress requires a narrowly scoped
route.

The identity package verifies credentials and the persistence package maps
verified `(issuer, subject)` pairs to internal owners. A deployment still needs
an OIDC login/callback or trusted identity gateway to issue the
`openlearn_session` cookie; no provider-specific login UI is hidden in the
repository.
