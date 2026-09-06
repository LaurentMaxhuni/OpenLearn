# `@openlearn/persistence`

This package is the production PostgreSQL adapter for the application ports.
It stores accepted plan aggregates, bounded operation state, minimal mutation
markers, plan deletion tombstones, personalization state, and the canonical
external-principal-to-owner mapping.

The adapter keeps SQL and row mapping out of `@openlearn/application` and
`@openlearn/domain`. Every accepted mutation writes the domain aggregate, the
terminal operation outcome, and the deduplication marker in one transaction.
Operation leases are fenced and can be reconciled by a bounded maintenance
sweep. Stored JSON is validated at the adapter boundary before it is returned
to application code.

Run migrations separately from application startup, and schedule the bounded
maintenance command at least every five minutes in beta:

```powershell
pnpm --filter @openlearn/service build
pnpm --filter @openlearn/service migrate
pnpm --filter @openlearn/service maintenance
```

The reviewed operator copy of migration 001 is
`migrations/001_initial.sql`. Use the environment and recovery procedures in
`docs/operations/DEPLOYMENT.md` and `docs/operations/RECOVERY.md` for hosted
deployments.
