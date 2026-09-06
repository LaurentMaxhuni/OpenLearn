# Recovery and rollback runbook

## Application rollback

1. Stop promotion of the new image and preserve the request ID, operation ID,
   build version, and timestamp.
2. Check `/health/ready` and the service error-rate metrics.
3. Roll the service and dashboard back to the last verified image pair.
4. Keep already-applied database migrations in place. Roll back code only when
   the previous image understands the current schema; otherwise deploy a
   forward-compatible repair image.
5. Re-run the smoke path and record the decision in the incident timeline.

Do not use `git reset`, destructive database resets, or ad-hoc row edits as an
operational recovery procedure.

## Uncertain or expired mutations

The application commits the domain aggregate, terminal outcome, and minimal
mutation marker together. If a client loses its response:

1. Retry with the same owner, capability, idempotency key, and request
   fingerprint.
2. Treat `in_progress` or `reconciling` as a recovery state; do not create a
   second key to guess whether the first request committed.
3. Run the bounded maintenance job:

   ```powershell
   pnpm --filter @openlearn/service build
   pnpm --filter @openlearn/service maintenance
   ```

4. A matching committed marker replays the outcome. If no commit is found, the
   operation resolves to a retryable `expired` result without writing learner
   state.

Schedule maintenance at least every five minutes in beta and alert if it
cannot run for two consecutive intervals. The job is bounded and safe to run
more than once.

## Database failure or restore

When PostgreSQL is unavailable, readiness returns 503 and mutations should be
retried after the database is healthy. For a restore:

1. Restore to an isolated instance and verify the schema migration version.
2. Replay account and plan deletion tombstones before exposing any learner
   route.
3. Run the maintenance sweep and compare deleted-plan counts with the backup
   deletion ledger.
4. Validate owner isolation, progress versions, mutation markers, and identity
   mappings with a non-production test identity.
5. Cut traffic over only after the recovery evidence is recorded.

Backups and restore media must expire or be scrubbed within 35 days of account
deletion. A restore that cannot prove this replay is not production-ready.

## Deletion recovery

Plan deletion hides the plan immediately and writes a tombstone. Primary plan,
revision, progress, and personalization data are purged within 24 hours. A
stale retry must resolve to the existing terminal result and must never
recreate the plan. Do not remove tombstones early; they protect against stale
requests and backup resurrection.

## Secret and identity recovery

Rotate database credentials and session secrets through the secret manager,
restart the service, and invalidate old browser sessions as required by the
chosen identity gateway. Rotate OIDC signing keys through the provider's JWKS
process and verify the new key before removing the old key. Record the
identity-provider and secret-manager change IDs; never put secrets in an issue,
log line, or release note.
