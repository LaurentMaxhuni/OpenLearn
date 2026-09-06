# Operational ownership

This record is the minimum ownership contract for beta. Replace the role
aliases with named maintainers or team rotations before inviting external
learners; repository maintainers are the default owners only until a deployment
names its own contacts.

| Area | Accountable role | Primary responsibility | Evidence |
| --- | --- | --- | --- |
| Release | Release owner | Verify gates, image digests, migration order, and rollback pair | Stable checklist |
| Service | Service owner | Fastify API, MCP boundary, readiness, rate limits, and maintenance | Service runbook |
| Dashboard | Dashboard owner | Connected build, CSP/Nginx, API proxy, and browser smoke path | Deployment smoke record |
| Data | Data owner | PostgreSQL, migrations, backups, restore tests, deletion replay | Recovery record |
| Identity | Identity owner | OIDC issuer/JWKS, principal provisioning, session lifecycle, and rotation | Identity configuration record |
| Security/privacy | Security owner | Threat review, incident classification, retention, and disclosure | Security/privacy review |
| Community/support | Community owner | Beta intake, support triage, contributor response, and release communication | Beta feedback log |

## Required cadences

- Before each beta release: release, service, data, and identity owners review
  the stable checklist.
- At least weekly during beta: review error/rate-limit/reconciliation trends
  and open feedback findings.
- At least monthly: verify a backup restore in an isolated environment and
  rehearse deletion-tombstone replay.
- After every incident: the incident commander assigns follow-up owners and a
  due date in the private tracker.

No single dashboard, database, identity, or registry credential should be
required by an individual maintainer. Store access in the deployment's
approved secret manager and keep break-glass access auditable.
