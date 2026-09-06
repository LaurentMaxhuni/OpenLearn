# Incident response

## Roles

The [ownership record](OWNERSHIP.md) assigns the incident commander, service
responder, data/backup responder, and communications owner for each beta
deployment. A single person may hold more than one role for a small preview,
but the assignment must be explicit before traffic is admitted.

## First ten minutes

1. Declare the incident in the private incident channel and assign an incident
   commander.
2. Capture environment, build version, first-seen time, affected route, health
   state, and representative request/operation IDs.
3. Check the deployment, database, identity provider, ingress, and latest
   migration separately.
4. Decide whether to pause writes, roll back the image, or keep serving reads.
5. Do not copy learner content, bearer tokens, cookies, or raw request bodies
   into the incident record.

## Common paths

| Symptom | First action | Escalation |
| --- | --- | --- |
| Readiness 503 | Check PostgreSQL connectivity and pool saturation | Data/backup responder |
| 401/403 spike | Compare issuer, audience, JWKS, cookie, and allowed-origin configuration | Identity responder |
| 409/conflict spike | Preserve operation IDs and check stale client/image mix | Service responder |
| `reconciling` growth | Run bounded maintenance and inspect database locks | Service + data responder |
| `/api` browser failures | Check dashboard build mode, same-origin proxy, CORS, and CSRF cookie | Dashboard responder |
| Asset/CSP failure | Compare image digest and deployed security headers | Dashboard responder |
| Deletion/restore concern | Pause restore traffic and verify tombstones/backups | Data/backup responder |

## Closeout

The incident commander records impact, timeline, root cause, data-handling
assessment, mitigation, follow-up owner, and verification evidence. Security or
privacy-impacting events also follow [SECURITY.md](../../SECURITY.md) and the
applicable legal notification process. Redact the public summary and never
publish learner content or credentials.
