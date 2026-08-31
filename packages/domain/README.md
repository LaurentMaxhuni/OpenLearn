# `@openlearn/domain`

`@openlearn/domain` is the framework-neutral, synchronous domain boundary for
OpenLearn learning plans. It accepts untrusted plan-shaped candidates, returns
canonical normalized content or bounded failures, and models accepted plan
revisions, learner-confirmed progress, deletion, retention deadlines, and safe
dashboard snapshots.

The package does not generate curriculum, interpret conversations, render UI, or
perform persistence. Application and adapter layers own authentication,
canonical issuer/subject resolution, transactions, operation lifecycle,
idempotency storage, and transport-specific envelopes.

## Accepted state

`normalizePlanContent` validates required hierarchy, safe text and HTTPS
destinations, opaque stable identifiers, sibling order, and configured bounds.
`createPlan` accepts the first canonical snapshot. `replacePlan` uses the
current opaque `RevisionId` as a compare-and-set guard and preserves confirmed
progress for item IDs that the replacement carries forward.

## Learner state and deletion

`applyProgressAction` is the only domain path that changes learner progress.
It accepts explicit start, complete, and undo-completion actions with both
revision and progress-version fencing. Operation states such as pending or
retryable are not progress values; the caller keeps them in its application
layer.

`deletePlan` is a one-way active-to-deleted transition. A deleted aggregate
contains only identity, an empty readable progress view, and a minimal terminal
tombstone. `retentionDeadlines` calculates the documented purge and metadata
windows; it does not delete or scrub data.

## Dashboard handoff

`readOwnedAcceptedSnapshot` maps an authorized active aggregate to a stable,
framework-neutral view containing canonical content, optional-field diagnostics,
current-item confirmed progress, counts, and the first incomplete item. It
does not construct routes or expose provider payloads, credentials, raw identity
claims, operation-internal data, or unvalidated candidate content.

The package intentionally has no runtime dependency on a UI framework, web
server, MCP SDK, database, ORM, OAuth/OIDC SDK, or provider SDK.
