# OpenLearn Phase 4: Learning-plan domain-model specification

**Status:** Draft for review

**Phase:** 4 - Learning-plan domain model

**Purpose:** Define the canonical, framework-neutral domain contract for accepted learning plans, revisions, learner-confirmed progress, ownership, validation, deletion, and the safe presentation handoff.

**Scope:** This specification defines domain concepts and their invariants. It does not select an ORM, database schema, migration tool, MCP SDK, exact MCP tool names, provider payloads, HTTP routes beyond the already accepted dashboard references, or a frontend framework.

## 1. Boundary and normative language

OpenLearn is a provider-neutral state and presentation surface. An external AI client owns the conversation, interprets learner intent, and generates or revises plan-shaped content. OpenLearn validates that content, assigns or preserves domain identity, stores accepted state, exposes stable references, renders the dashboard, and records explicit learner progress.

The domain boundary:

- accepts only canonical plan-shaped content and learner commands supplied through an application layer;
- owns plan structure, identifiers, relationships, ordering, revision identity, accepted-state meaning, progress meaning, and domain validation;
- does not interpret prompts, generate curricula, tutor, grade, host a model, or decide what a learner should study;
- receives an internal owner reference from the authentication/application boundary, not a token, provider account, email address, or caller-selected actor ID; and
- returns structured domain outcomes that the application layer maps to transport results and the Phase 3 dashboard view models.

The words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are normative. A candidate is external and untrusted until it passes every validation gate. An accepted revision is the only plan content eligible for dashboard rendering.

### 1.1 Phase 2 invariants carried forward

Phase 4 refines the domain contract without weakening these accepted architecture decisions:

| Invariant | Phase 4 consequence |
| --- | --- |
| Dashboard OIDC and remote MCP OAuth use one canonical issuer and map the same issuer/subject pair to one internal owner. | Ownership checks use the resolved internal owner; the domain never matches by email, provider account, display name, or subject alone. |
| Accepted plans remain available while the owning account and plan exist. | A failed, pending, cancelled, expired, conflicted, or invalid candidate never replaces the current accepted revision. |
| Account deletion revokes access immediately and purges primary data within 24 hours. | Deleted plans and all owned progress become inaccessible immediately; purge includes accepted revisions, content, and progress. |
| Full operation lifecycle and replay data expire after 24 hours. | Operation state is not the source of truth for accepted plan or progress state. |
| Minimal mutation deduplication markers remain while the account exists and for 35 days after deletion. | Retried mutations cannot become fresh mutations after the full operation record expires or the account is deleted. |
| Redacted telemetry is retained for 30 days; minimal security and ownership audit metadata for 90 days. | Domain errors and audit fields contain only bounded, redacted metadata. |
| Backups expire or are scrubbed within 35 days. | Restore processing MUST replay deletion tombstones before serving data. |
| Abandoned mutations reconcile from a durable reference to succeeded or expired under the Phase 2 lease and fencing rules. | Domain acceptance is committed with the terminal operation outcome and deduplication marker; a stale worker cannot finalize a mutation. |
| Stale revisions must not overwrite confirmed progress. | Revision replacement is compare-and-set against the current revision and never writes learner progress. |
| Deleted plans must not be resurrected by delayed or retried requests. | Deletion is one-way; tombstones reject stale writes and a new plan receives a new identity. |

## 2. Concise domain glossary

| Term | Meaning |
| --- | --- |
| Owner | The internal learner identity resolved from the canonical issuer and subject by the authentication/application boundary. |
| Plan | The root domain aggregate that owns one current accepted revision, its stable identity, its lifecycle, and learner progress references. |
| Goal | The required primary learning objective of a plan. The first-release contract has one primary goal per plan. |
| Context | Optional learner-supplied context that helps explain the goal, constraints, or starting situation. It is never invented by OpenLearn. |
| Milestone | An ordered major grouping under a plan. |
| Topic | An ordered grouping under a milestone that contains plan items. |
| Plan item | The smallest learner-actionable unit in the first-release outline. |
| Resource | An optional plan-supplied label and, when safe, an HTTPS destination associated with an item. |
| Candidate | Unaccepted external content being validated for a new plan or replacement revision. A candidate is not dashboard state. |
| Revision | An immutable accepted snapshot of plan content with its own opaque identity and monotonically increasing number within a plan. |
| Current revision | The one accepted revision selected by the active plan for dashboard reads and learner actions. |
| Replacement | A full candidate snapshot that may become the next current revision. Phase 4 does not define patch or merge semantics. |
| Confirmed progress | A learner-authorized, durably accepted state for a stable plan item. It is separate from candidate content and operation status. |
| Progress version | A monotonic compare-and-set value for one owner's progress record on one plan item. |
| Operation | Integration/application lifecycle state such as received, in progress, reconciling, succeeded, rejected, failed_retryable, cancelled, expired, or conflict. It is not plan content or confirmed progress. |
| Mutation reference | The durable operation and idempotency information used to reconcile an abandoned mutation and reject unsafe replay. |
| Tombstone | Minimal deletion evidence that prevents reads, stale mutations, retries, or restored backups from resurrecting a deleted plan. |
| Opaque identifier | A bounded identifier whose value is used for equality and reference only. Titles, order, email, provider identity, and parsed substrings never determine it. |
| Canonical order | The explicit sibling-array order in an accepted revision. It is semantic and is not replaced by alphabetical, timestamp, or database order. |
| Non-disclosing unavailable | The common presentation result for a missing, deleted, or unauthorized resource when revealing which condition occurred would disclose resource status. |

## 3. Canonical aggregate and relationships

The canonical structure is an explicit typed tree:

~~~text
Plan
├── Goal                         required, one primary goal
├── Context                      optional
│   └── ContextEntry[]           optional, ordered when present
└── Milestone[]                  required, ordered and non-empty
    └── Topic[]                 required for each milestone, ordered and non-empty
        └── PlanItem[]          required for each topic, ordered and non-empty
            └── Resource[]      optional, ordered when present
~~~

The tree is the canonical content relationship. A plan item belongs to exactly one topic in a revision, a topic belongs to exactly one milestone, and a milestone belongs to exactly one plan. A resource belongs to exactly one plan item. The domain does not infer relationships from titles or array position after identity has been assigned.

### 3.1 Canonical content shape

The following is a framework-neutral conceptual shape. It describes the domain contract, not a database row or a protocol payload:

~~~text
CanonicalPlanContent {
  title?: ShortText
  goal: Goal
  context?: Context
  milestones: Milestone[]
}

Goal {
  goalId: GoalId
  title: ShortText
  description?: LongText
}

Context {
  summary?: LongText
  entries?: ContextEntry[]
}

ContextEntry {
  entryId: ContextEntryId
  label: ShortText
  value: LongText
}

Milestone {
  milestoneId: MilestoneId
  title: ShortText
  description?: LongText
  topics: Topic[]
}

Topic {
  topicId: TopicId
  title: ShortText
  description?: LongText
  items: PlanItem[]
}

PlanItem {
  itemId: PlanItemId
  title: ShortText
  description?: LongText
  resources?: Resource[]
}

Resource {
  resourceId: ResourceId
  label: ShortText
  href?: SafeHttpsUrl
  opaqueReference?: BoundedOpaqueText
}
~~~

The accepted aggregate additionally contains:

~~~text
Plan {
  planId: PlanId
  ownerId: InternalOwnerId
  lifecycle: active | deleted
  currentRevision: AcceptedRevisionRef?
  progress: LearnerProgressRecord[]
}

AcceptedRevisionRef {
  revisionId: RevisionId
  revisionNumber: PositiveInteger
  acceptedAt: Timestamp
}
~~~

An active plan MUST have one current accepted revision. A plan that has never accepted a revision is represented by an application operation or pending reference, not by a renderable active Plan aggregate. A deleted plan has no renderable current revision, and its tombstone is not a dashboard content response.

### 3.2 Required and optional content

The following structure is required for an accepted revision:

- a valid plan identity and owner context supplied by the application;
- one non-empty Goal with a non-empty title;
- one to fifty non-empty Milestone objects;
- at least one Topic in every Milestone;
- at least one PlanItem in every Topic; and
- a non-empty title on every Milestone, Topic, and PlanItem.

The following content is optional:

- the plan title, because the goal can provide the primary heading;
- Goal, Milestone, Topic, and PlanItem descriptions;
- Context and its entries;
- PlanItem resources; and
- a Resource href or opaque reference when the resource label alone is useful.

Missing required structure is rejection, not a partial accepted plan. Missing optional content is accepted as absent and is never replaced with generated filler. The validator records the missing optional enrichment paths so the application can map a structurally valid but under-described revision to the Phase 3 partial presentation state. Absence of learner context, a plan title, a resource, or a resource destination is not by itself a validation failure.

The initial completeness rule is deterministic: a revision is structurally complete when every required field is present and valid; it is presentation-partial when at least one optional descriptive field is absent while the rest of the required structure is valid. Context and resources are reported as absent/empty independently and do not make a revision invalid. A later contract may revise this rule only by versioning the domain contract.

## 4. Identity and ordering rules

### 4.1 Stable identifiers

The domain owns the identity boundary:

- PlanId, RevisionId, GoalId, MilestoneId, TopicId, PlanItemId, ResourceId, and ContextEntryId are opaque, non-empty, bounded identifiers.
- The canonical syntax is 1 to 128 ASCII characters matching the pattern ^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$. The syntax is a safety bound, not business meaning.
- Identifier comparison is exact and case-sensitive. The domain does not case-fold, slugify, hash titles, or derive identity from position.
- PlanId is allocated once for the first accepted plan and never changes. A failed first submission does not reserve a renderable plan.
- RevisionId is allocated for each accepted revision and never reused. RevisionNumber starts at 1 and increases by exactly one for each accepted replacement.
- Nested IDs are domain IDs. An initial candidate may receive fresh domain IDs during normalization when no prior identity exists. A revision that intends to preserve an existing logical item MUST carry that previously issued PlanItemId through the application mapping.
- A candidate-provided identifier is data, not proof of ownership. The application binds the candidate to the resolved owner and the domain validates only its shape and identity scope.
- A missing or new nested ID creates a new logical entity. The domain does not match it to an existing entity by title, description, position, or resource URL.

PlanId and RevisionId are globally unique within the domain authority. Nested IDs are unique within their entity type and plan; all PlanItemIds are unique across the entire plan because progress targets them directly. A pair of entity type and ID is the identity key where a cross-type lookup is needed.

### 4.2 Ordering

- The order of the milestones array is the canonical milestone order.
- The order of each topics array is the canonical topic order within its milestone.
- The order of each items array is the canonical plan-item order within its topic.
- The order of each resources array is the canonical resource order for its item.
- The order of context entries is preserved when present.
- Array order is never sorted by title, timestamp, ID, or database position.
- A revision may intentionally reorder existing entities. Reordering does not change their identity or learner progress.
- New entities appear in the submitted order. Omitted entities are absent from the current revision; the domain does not silently append them or infer that they moved.
- The deterministic next action is the first current PlanItem in depth-first milestone, topic, item order whose confirmed state is not completed_by_learner.

## 5. Validation and normalization

Validation is a pure, bounded domain operation. It does not fetch resources, call a provider, interpret a prompt, resolve a URL, or write partial content.

### 5.1 Scalar and collection bounds

The initial version uses these canonical bounds:

| Value | Rule |
| --- | --- |
| ShortText | 1 to 240 Unicode scalar values after normalization. |
| LongText | 1 to 4,000 Unicode scalar values after normalization. |
| BoundedOpaqueText | 1 to 512 Unicode scalar values after normalization. |
| Identifier | 1 to 128 ASCII characters using the canonical identifier syntax. |
| SafeHttpsUrl | Absolute HTTPS URL, no user information, no control characters, at most 2,048 characters. |
| Context entries | 0 to 50 when Context is present. |
| Milestones | 1 to 50 per plan. |
| Topics | 1 to 200 across a plan. |
| Plan items | 1 to 1,000 across a plan. |
| Resources | 0 to 20 per plan item. |
| Canonical text | At most 200,000 Unicode scalar values across one candidate after normalization. |

The application or transport MAY enforce lower request limits. It MUST NOT raise the domain limits without a versioned contract change.

### 5.2 Deterministic normalization

Before structural validation, the validator:

1. normalizes Unicode text to NFC;
2. converts CRLF and CR line endings to LF;
3. converts tabs to one ordinary space;
4. trims leading and trailing Unicode whitespace from every text value;
5. preserves internal spaces and line breaks;
6. rejects NUL and other C0 control characters; and
7. treats a normalized empty optional string as absent, while rejecting a normalized empty required string.

Identifiers are not whitespace-trimmed or case-folded into a different identity. They must already satisfy the identifier syntax. Null is not equivalent to absent: null in an optional field is rejected as malformed unless a future version explicitly defines null.

The validator preserves sibling-array order exactly. It does not sort, deduplicate, infer missing nodes, or merge similar titles. Normalization is deterministic and has no network or provider dependency.

### 5.3 Structural, safety, and unknown-field rules

- The canonical object kind and every field type MUST match the contract.
- Unknown fields are rejected rather than silently dropped. This prevents typos, hidden provider instructions, and unsafe data from being mistaken for accepted content.
- A candidate cannot include learner progress, owner identity, lifecycle, accepted revision metadata, operation outcome, or deletion fields inside content. Such fields are rejected as unknown or forbidden content.
- Duplicate IDs are rejected for the entire candidate. Duplicate titles, descriptions, or resource labels are allowed because equal text does not prove equal identity.
- A relationship is invalid if a child appears under more than one parent, a required child array is empty, or a resource is attached outside its owning item.
- Plain text is data and is rendered escaped by later layers. The domain never executes or interprets HTML, JavaScript, component names, CSS, SQL, or network instructions. A field that is explicitly attempting executable markup or code is rejected by the safety validator; it is not normalized into accepted content.
- A supplied href must be a safe absolute HTTPS URL with no credentials. Data, file, javascript, blob, protocol-relative, and non-HTTPS schemes are rejected. The domain does not fetch or verify the destination.
- A label-only Resource is valid. An opaqueReference is preserved only as bounded data and is never used to construct navigation, fetch a URL, establish ownership, or authorize a mutation. An invalid supplied href is rejection; it is not silently downgraded to a label-only resource.

### 5.4 Validation outcomes

The domain returns one of two content outcomes:

- Accepted: a fully normalized canonical content value plus deterministic optional-field diagnostics.
- Rejected: no accepted content and one or more bounded validation categories.

Representative rejection categories are:

| Category | Examples | State consequence |
| --- | --- | --- |
| malformed_input | Wrong scalar type, null where absent is required, invalid object shape | Reject candidate; preserve current accepted revision. |
| missing_required | Empty goal title, empty milestone, topic, or item collection; missing required title | Reject candidate; do not create an accepted plan on first submission. |
| invalid_identifier | Identifier outside syntax or scope | Reject candidate; no partial identity is committed. |
| duplicate_identifier | Repeated plan-item or nested ID | Reject the entire candidate; never choose a winner. |
| invalid_relationship | Child attached to multiple parents or resource outside an item | Reject the entire candidate. |
| unsafe_content | Executable markup, unsafe URL scheme, disallowed control content | Reject the entire candidate; do not render a sanitized guess as accepted content. |
| too_large | Scalar, collection, or total-candidate limit exceeded | Reject before persistence; do not retain the payload as learner content. |
| unknown_field | Field outside the canonical version | Reject; callers must use a version that declares the field. |

Validation details returned to an authorized caller MAY include a bounded canonical path such as milestones[1].topics[0].items[2].title and a safe category. They MUST NOT include raw credentials, tokens, internal traces, unbounded request bodies, or provider-specific claims. The exact outer error envelope belongs to the application and Phase 6.

## 6. Plan lifecycle and accepted-state semantics

### 6.1 Plan lifecycle

Plan lifecycle is intentionally smaller than operation lifecycle:

~~~text
uncreated -> active -> deleted
~~~

- Uncreated is the absence of an accepted plan; a pending operation may exist outside the domain aggregate.
- Active means the plan has one current accepted revision and is available only to its owner.
- Deleted is terminal. The plan's content and progress are inaccessible immediately, primary data is purged within 24 hours, and a minimal tombstone prevents resurrection.
- There is no accepted-domain lifecycle value for pending, invalid, retryable, expired, cancelled, or conflict. Those are operation outcomes or application presentation states.

### 6.2 Acceptance and replacement

An acceptance transaction MUST atomically:

1. validate and normalize the complete candidate;
2. check owner and plan identity;
3. check the expected base revision for a replacement;
4. assign or preserve domain IDs;
5. create the immutable accepted revision and its revision number;
6. move the plan's current-revision reference to the new revision; and
7. commit the terminal mutation outcome and minimal deduplication marker under the Phase 2 fencing rules.

The domain does not expose a candidate as accepted while validation or persistence is incomplete. A pending or recovering operation may have an operation reference, but it has no permission to replace the current accepted content.

Every replacement is a full canonical snapshot. Phase 4 does not define patches, field-level merges, or conflict-free merging. A replacement may change content, order, parent relationships, and optional fields, but it must satisfy the complete required tree.

When a replacement is accepted:

- the PlanId is unchanged;
- a new RevisionId and the next RevisionNumber are created;
- existing logical entities retain their IDs only when the candidate carries those IDs;
- new entities receive new IDs and start with default confirmed progress;
- omitted entities are not current in the new revision;
- progress records are not rewritten by content replacement; and
- the current accepted revision changes only after the whole candidate is accepted.

The domain treats an unchanged PlanItemId as the same logical item even if its title, description, resource list, parent, or position changes. The submitting application must issue a new item ID when the item is materially different. The domain does not attempt semantic identity matching.

### 6.3 Revision compare-and-set and stale conflicts

A replacement for an existing plan MUST identify the expected current revision. The application may carry both RevisionId and RevisionNumber, but the domain compares against the authoritative current revision reference.

- A matching expected revision allows validation and replacement.
- A missing expected revision for an existing plan is rejected as an unsafe update.
- A non-matching expected revision is a stale_revision conflict. The current accepted revision and all progress remain unchanged.
- Two valid candidates based on the same current revision are serialized; only the first successful acceptance advances the current revision. The other receives a conflict and must be rebuilt from a fresh read.
- A stale candidate is never auto-merged, applied after the current revision, or allowed to reset progress.

RevisionNumber is monotonic within a Plan and is not reused after a failed or conflicted attempt. Failed candidates do not create accepted revisions.

### 6.4 Preservation of the last accepted plan

For an existing active plan, all of the following preserve the current accepted revision and confirmed progress:

- malformed, incomplete, duplicate, unsafe, oversized, or unknown-field candidate;
- pending or in-progress replacement;
- interrupted or reconciling operation;
- rejected, failed_retryable, cancelled, expired, or conflict operation;
- stale revision or mutation reference;
- authorization failure as observed by the caller; and
- an uncertain response whose same idempotency key has not yet resolved.

For a first submission with no accepted plan, a failed candidate produces no Plan aggregate and no renderable content. An operation or recovery reference MAY remain under the Phase 2 retention rules, but it is not a partial plan.

## 7. Learner-confirmed progress

Progress is an owner-scoped domain record keyed by PlanId and stable PlanItemId. It is not part of candidate content and it is not inferred from whether an item is selected, opened, displayed, or mentioned by an external AI client.

### 7.1 Progress record

~~~text
LearnerProgressRecord {
  ownerId: InternalOwnerId
  planId: PlanId
  itemId: PlanItemId
  state: not_started | in_progress | completed_by_learner
  progressVersion: NonNegativeInteger
  lastNonCompleteState?: not_started | in_progress
  lastConfirmedAt: Timestamp
}
~~~

The absence of a record has the canonical effective state not_started and progressVersion zero. An implementation may materialize that default for queries, but it must not treat an absent record as unknown or completed.

Only an explicit learner-authorized transition can produce in_progress or completed_by_learner. External plan content cannot set, clear, or overwrite progress. If candidate content contains a progress field, it is rejected as forbidden or unknown content.

### 7.2 Allowed actions and transitions

The domain defines these conceptual learner actions. Their transport names are not selected here:

| Action | Allowed source | Result | Required behavior |
| --- | --- | --- | --- |
| start item | not_started | in_progress | Records explicit learner intent. This transition makes the in_progress state meaningful; a Phase 3 host is not required to expose a separate start control. |
| complete item | not_started or in_progress | completed_by_learner | Required first-release learner action. Records the prior non-complete state for undo. |
| undo completion | completed_by_learner | lastNonCompleteState, defaulting to not_started | Required first-release reversible action. The application does not guess the target state. |

The following transitions are not permitted:

- completing an already completed item as a new action;
- undoing an item that is not completed_by_learner;
- starting an item that is already completed_by_learner;
- changing progress for an item that is not in the current accepted revision;
- changing progress for a plan that is deleted or not owned by the actor; and
- accepting a progress target supplied by external content.

A new request with the same mutation identity replays its existing result under the Phase 2 idempotency rules. A new request with a stale version is a conflict, not an automatic no-op. A request whose source state does not permit the action is rejected without changing progress.

### 7.3 Progress concurrency

Every progress mutation carries the expected current Plan revision and expected item progressVersion:

1. ownership and active-plan checks run first;
2. the expected current revision must match;
3. the expected progressVersion must match;
4. the source state must permit the conceptual action;
5. the new state and lastNonCompleteState are written atomically; and
6. progressVersion increments exactly once on an accepted state change.

A revision conflict or stale progressVersion leaves the stored progress untouched. A content revision accepted after a learner progress read does not erase progress; the learner action must refresh against the current revision before it can proceed. The application maps these outcomes to the Phase 3 action state and preserves the last confirmed progressState during pending, conflict, or retryable presentation.

### 7.4 Revision interaction

Progress is independent of the accepted content snapshot but scoped to stable item identity:

- an unchanged PlanItemId carries its confirmed state into an accepted replacement;
- a new PlanItemId has effective state not_started;
- an omitted item is not current and is excluded from current progress summaries, but its historical progress is not silently rewritten while the plan exists;
- if the same PlanItemId returns in a later revision, its prior confirmed state is still the state for that logical item;
- moving an item between topics or milestones does not reset progress; and
- deleting the plan purges all progress, including non-current historical records, within the Phase 2 deadline.

These rules prevent a stale or valid replacement from overwriting learner confirmation while allowing a deliberate content revision to preserve identity where the submitting application says the item is the same.

## 8. Ownership and authorization invariants

The domain and application boundary enforce these invariants together:

- every plan, revision, progress record, deletion request, and mutation reference is scoped to one internal owner;
- the internal owner is resolved from the verified canonical issuer/subject mapping before a domain command runs;
- a caller cannot choose an owner by supplying an actor ID in plan content or a command argument;
- the dashboard OIDC session and remote MCP OAuth request resolve to the same internal owner for hosted access;
- a different issuer is not matched by email, display name, provider account, or equal subject value;
- the domain never authorizes a plan by a dashboard URL, raw token, provider reference, title, or guessed ID;
- an owner mismatch, missing plan, or deleted plan is mapped to the same non-disclosing unavailable result at the presentation boundary;
- unauthorized operations do not attach a plan reference, accepted content, progress, resource details, or corrective guidance that reveals whether a resource exists; and
- account deletion revokes the owner before purge begins, so no new read or mutation can race with deletion.

Authorization is not a content-validation failure. A malformed submission may be explained to an authorized caller as a bounded validation rejection. An actor who lacks authorization receives a non-disclosing unavailable result and must not be told to correct the submission.

## 9. Errors, conflict semantics, and operation mapping

Domain errors describe why a command did not change accepted state. Application and transport layers may map them to Phase 2 operation states, but the domain must not confuse an unsafe retry with invalid content.

| Domain outcome | Meaning | Accepted state effect | Safe recovery |
| --- | --- | --- | --- |
| validation_rejected | Candidate is malformed, incomplete, unknown, duplicate, unsafe, or too large | Preserve current accepted revision and progress | Correct the bounded candidate if the authorized caller has enough information. |
| stale_revision | Replacement used a non-current expected revision | No write | Fresh read, rebuild full replacement, submit against current revision. |
| stale_progress | Learner action used a non-current progressVersion or plan revision | No write | Fresh read; do not display or apply the unconfirmed target. |
| invalid_transition | Action source state does not allow the requested transition | No write | Refresh and expose only the permitted action for the confirmed state. |
| deletion_conflict | Delete expected revision or idempotency/concurrency check did not establish a safe deletion commit | Keep active plan and progress | Fresh read before a new deletion decision; never retry the stale decision. |
| owner_unavailable | Actor is missing, mismatched, unauthorized, or the plan is absent/deleted | Do not disclose resource state | Generic unavailable state and safe navigation. |
| plan_deleted | The plan's terminal lifecycle is deleted | No resurrection | Treat as unavailable; a new plan requires a new authorized operation and identity. |
| mutation_replay_conflict | Reused mutation identity has a different request fingerprint or owner/capability scope | No write | Fail closed; use a new authorized operation only when the caller has a genuinely new intent. |

The Phase 2 operation states received, in_progress, reconciling, succeeded, rejected, failed_retryable, cancelled, expired, and conflict remain the integration lifecycle. In particular:

- rejected maps to invalid only for validation, shape, or safety rejection; authorization maps to unavailable;
- conflict for a stale revision, stale progress, mutation fingerprint, or deletion concurrency check requires fresh state and is not a retryable failure;
- failed_retryable preserves the last accepted plan and may offer a retry under the same Phase 2 identity rules;
- reconciling never claims an accepted replacement or deletion before the durable result is known; and
- a terminal non-creation outcome after expiry or replay never creates a new plan or resurrects a deleted one.

The exact result envelope, error-code strings, and MCP names are Phase 6 work. The meanings and state-preservation rules above are Phase 4 contract.

## 10. Deletion and retention

Deletion is a data-control lifecycle separate from content replacement and learner progress.

### 10.1 Deletion rules

An authorized owner may request deletion of an active plan using the current plan identity and an expected current revision. The application supplies mutation identity and authorization context; the domain enforces the state transition:

~~~text
active -> deleted
~~~

- A successful deletion makes reads and writes unavailable immediately across dashboard and MCP paths.
- The current revision, all revisions, all progress, and all plan resources become inaccessible immediately and are scheduled for primary purge within 24 hours.
- The deletion tombstone remains only as long as needed to reject stale operations and prevent backup restore resurrection under the Phase 2 retention rules.
- A deletion request with a stale expected revision or failed idempotency/concurrency check returns deletion_conflict, keeps the active plan, and requires a fresh read. It is not mapped to failed_retryable and is not retried with the stale decision.
- A delayed or retried request cannot recreate, un-delete, or write to a deleted plan. A same-key retry replays the durable deletion outcome; a new key against a deleted plan receives the non-disclosing unavailable result.
- Creating another plan after deletion requires a new authorized operation and a new PlanId.

Deletion confirmation is an application/UI concern. The domain receives a confirmed delete intent, not a browser dialog state. The Phase 3 dashboard contract requires the non-modal confirmation disclosure, no optimistic removal while the outcome is uncertain, generic unavailable after committed deletion, and fresh-read guidance for conflict.

### 10.2 Retention schedule

| Data | Retention and behavior |
| --- | --- |
| Accepted revisions, canonical content, and current/historical learner progress | Available while the owner account and plan exist; no inactivity expiry in the first release. |
| Primary content after plan deletion | Purged within 24 hours of the deletion request. |
| Primary content after account deletion | Access revoked immediately; all owned plan content and progress purged within 24 hours. |
| Full operation lifecycle and replay details | Expire 24 hours after terminal completion or expiration. |
| Minimal mutation deduplication marker | Retained while the account exists and for 35 days after account deletion, with no raw payload or token. |
| Deletion tombstone | Retained as the minimum anti-resurrection evidence, including through the 35-day backup window where needed. |
| Redacted operational telemetry | 30 days. |
| Minimal security and ownership audit metadata | 90 days. |
| Backups | Expire or are scrubbed within 35 days; restore must replay deletion tombstones before serving data. |

Retention expiration MUST NOT turn a known mutation key into a new mutation, remove the deletion barrier, or expose previously deleted content.

## 11. Dashboard and package handoff

The domain contract supplies safe inputs to the application mapping layer. It does not import or depend on packages/ui, a frontend framework, or a URL router.

For an authorized active plan, the mapping layer can produce the Phase 3 view model from:

- PlanId and current RevisionId as opaque references;
- the accepted Goal, optional Context, ordered Milestones, Topics, PlanItems, and Resources;
- the current content/operation state independently from accepted content;
- confirmed progressState values only: not_started, in_progress, or completed_by_learner;
- a LearnerActionViewModel whose submitting, conflict, failed_retryable, or unavailable state carries operation status without overwriting confirmed progress;
- a PlanDataControlsViewModel whose deletion conflict requires fresh-read guidance and whose deleted/unavailable result is non-disclosing; and
- a server-supplied safe dashboard handoff created by the application from the opaque PlanId.

The mapping layer:

- preserves canonical sibling-array order and stable IDs;
- calculates current progress counts from current items and stored learner-confirmed records;
- excludes candidate, rejected, pending, or stale content from the accepted view;
- carries progress for a stable item ID across an accepted replacement;
- maps missing optional fields to absent or Phase 3 partial presentation without inventing values;
- maps owner mismatch, missing, and deleted results to the same unavailable presentation; and
- never exposes owner claims, raw tokens, raw request payloads, internal database records, or provider-specific fields to packages/ui.

The domain does not construct dashboard URLs. The application/service creates the authenticated /plans/{plan_id} handoff from its configured dashboard origin, and the UI navigates only to that safe reference.

## 12. Representative valid examples

### 12.1 Complete accepted content

This example uses deterministic fixture IDs and shows the required hierarchy:

~~~json
{
  "planId": "fixture-plan-basics",
  "ownerId": "owner-internal-fixture",
  "lifecycle": "active",
  "currentRevision": {
    "revisionId": "fixture-revision-001",
    "revisionNumber": 1,
    "acceptedAt": "2030-01-02T03:04:05Z"
  },
  "content": {
    "title": "Web foundations",
    "goal": {
      "goalId": "fixture-goal-web",
      "title": "Learn the foundations of the web",
      "description": "Build a clear mental model of browsers, documents, styles, and requests."
    },
    "context": {
      "summary": "The learner is new to web development.",
      "entries": [
        {
          "entryId": "fixture-context-background",
          "label": "Starting point",
          "value": "No prior programming experience is assumed."
        }
      ]
    },
    "milestones": [
      {
        "milestoneId": "fixture-milestone-foundations",
        "title": "Understand the browser",
        "description": "Learn how a browser turns a document into an interactive page.",
        "topics": [
          {
            "topicId": "fixture-topic-documents",
            "title": "Documents and structure",
            "description": "Recognize the role of HTML in a web document.",
            "items": [
              {
                "itemId": "fixture-item-reading",
                "title": "Read a document structure overview",
                "description": "Identify the main structural elements in a simple document.",
                "resources": [
                  {
                    "resourceId": "fixture-resource-mdn",
                    "label": "Document structure reference",
                    "href": "https://example.test/resources/document-structure"
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        "milestoneId": "fixture-milestone-practice",
        "title": "Practice the model",
        "description": "Use the model to explain a basic request.",
        "topics": [
          {
            "topicId": "fixture-topic-requests",
            "title": "Requests and responses",
            "description": "Connect a browser action to a request and response.",
            "items": [
              {
                "itemId": "fixture-item-request-flow",
                "title": "Trace a request flow",
                "description": "Describe the visible steps in a simple page request.",
                "resources": []
              }
            ]
          }
        ]
      }
    ]
  }
}
~~~

The accepted progress record may independently say that fixture-item-reading is in_progress and fixture-item-request-flow is not_started. That progress is learner state, not content supplied in this example.

### 12.2 Accepted structurally valid partial content

An accepted candidate may omit the plan title, context, descriptions, and resources while retaining a valid goal, non-empty milestones, non-empty topics, and non-empty item titles. The domain accepts it as structurally valid, records the missing optional enrichment paths, and the application maps it to a partial presentation. It does not invent descriptions, context, links, or a next action outside the ordered items.

## 13. Invalid and rejected examples

| Example | Expected result |
| --- | --- |
| Goal has no title after whitespace normalization. | Reject as missing_required; preserve the last accepted plan or create no plan on first submission. |
| A milestone contains an empty topics array. | Reject as missing_required; do not accept a partial milestone. |
| Two items use fixture-item-reading. | Reject the whole candidate as duplicate_identifier; never choose the first or last duplicate. |
| A revision omits the expected current revision. | Reject as an unsafe update; no accepted state changes. |
| A candidate uses a stale expected revision after another revision was accepted. | Return stale_revision conflict; preserve the current accepted content and progress. |
| A candidate includes learner progress or an ownerId inside content. | Reject as forbidden/unknown content; external content cannot set ownership or progress. |
| A resource href uses javascript:, data:, file:, HTTP credentials, or a non-HTTPS scheme. | Reject as unsafe_content; do not downgrade it silently to a label-only resource. |
| A resource has only a safe label and no href. | Accept as a label-only resource; no navigation is offered. |
| A resource uses opaqueReference with a bounded provider-neutral reference. | Accept as opaque data; display only the safe label and never fetch or authorize from the reference. |
| A candidate contains an unknown field such as generatedLesson or execute. | Reject as unknown_field; do not discard the field and accept the rest. |
| A candidate exceeds a scalar, collection, or total-text bound. | Reject as too_large before persistence or accepted rendering. |

## 14. Revision and progress transition examples

### 14.1 Accepted replacement preserves progress

1. Revision 1 is current. Item A has PlanItemId item-a and confirmed state completed_by_learner; item B is not_started.
2. A valid replacement uses the same PlanId and expected RevisionId 1, carries item-a unchanged in identity, adds new item C, and changes descriptions and order.
3. Revision 2 is accepted. Item A remains completed_by_learner, item B retains its prior state, item C is not_started, and current summaries use revision 2's order.
4. The revision operation did not write or reset learner progress.

### 14.2 Stale replacement cannot overwrite progress

1. Two candidates both read Revision 2. Candidate X is accepted as Revision 3.
2. Candidate Y arrives with expected Revision 2 and an altered item-a.
3. Candidate Y returns stale_revision conflict. Revision 3 and item-a's confirmed progress remain unchanged.
4. The caller must read Revision 3, rebuild a full replacement, and submit a new operation under the Phase 2 idempotency rules.

### 14.3 Completion, pending action, and undo

1. Item A is not_started with progressVersion 0.
2. The learner submits complete item with expected plan revision and progressVersion 0. While the operation is pending, the dashboard keeps not_started as the confirmed progressState and exposes submitting on LearnerActionViewModel.
3. If accepted, the domain changes state to completed_by_learner, stores lastNonCompleteState not_started, and increments progressVersion to 1.
4. The dashboard exposes undo_completion. While undo is pending, it continues to show completed_by_learner as the confirmed state.
5. If accepted, undo restores not_started and increments progressVersion. If conflict or retryable failure occurs, completed_by_learner remains authoritative.

### 14.4 In-progress completion and undo

1. Item B is explicitly started and becomes in_progress.
2. Completion changes it to completed_by_learner while storing in_progress as lastNonCompleteState.
3. Undo restores in_progress rather than guessing not_started.

### 14.5 Progress conflict

1. Two learner actions read progressVersion 4.
2. The first accepted action changes the record to completed_by_learner at version 5.
3. The second action with expected version 4 returns stale_progress and does not change the record.
4. The dashboard shows the version-5 confirmed state and requires a fresh read; it does not display the second action's target state as fact.

## 15. Ownership, deletion, and retention examples

### 15.1 Canonical owner mapping

A dashboard session and remote MCP authorization with the same configured issuer and subject resolve to one internal owner. A token from a different issuer, even with the same email or subject text, does not resolve to that owner. The denied result is non-disclosing and carries no plan reference.

### 15.2 Deletion conflict

1. The owner reads active PlanId P at Revision 7 and confirms deletion in the dashboard.
2. A revision changes the plan to Revision 8 before the delete command commits.
3. The delete command fails its expected-revision/concurrency check with deletion_conflict.
4. The plan and all confirmed progress remain available. The dashboard says to refresh before making a new deletion decision; it does not offer a blind retry of the stale command.

### 15.3 Committed deletion and delayed retry

1. An authorized deletion commits for PlanId P.
2. Dashboard collection reads omit P immediately, and a direct route maps to generic unavailable.
3. A delayed old revision, progress action, or deletion retry cannot write or resurrect P. The tombstone and mutation marker reject it.
4. A later new plan receives a new PlanId and is unrelated to P.

### 15.4 Account deletion

At account deletion, access to every owned plan is revoked before purge. Primary content, revisions, and progress are purged within 24 hours. Full lifecycle details expire after 24 hours, minimal mutation markers and deletion barriers remain through the 35-day backup window, redacted telemetry remains 30 days, and minimal security/ownership audit metadata remains 90 days. A restore replays tombstones before serving any learner state.

## 16. Deterministic fixture guidance

Phase 5, Phase 6, and later tests consume the same contract-shaped fixtures. Fixtures are not provider payloads and must not require a live AI client, database, identity provider, or MCP connection.

Every fixture:

- uses explicit IDs such as fixture-plan-basics, fixture-goal-web, fixture-milestone-foundations, fixture-topic-documents, fixture-item-reading, and fixture-resource-mdn;
- freezes acceptedAt and lastConfirmedAt at 2030-01-02T03:04:05Z unless a transition fixture requires a documented second timestamp;
- preserves array order exactly as the contract expects;
- uses current revision and progressVersion values explicitly;
- separates accepted content, operation state, confirmed progress, and presentation mapping in its expected result;
- uses safe example.test HTTPS links only;
- contains no prompts, bearer tokens, provider account identifiers, raw claims, or private learner data; and
- asserts IDs, order, state, error category, preservation behavior, and safe recovery text, not only rendered pixels.

The minimum domain fixture matrix is:

| Fixture | Contract coverage |
| --- | --- |
| accepted-complete | Full required tree, descriptions, context, resources, revision 1, and mixed confirmed progress. |
| accepted-partial | Required tree valid with missing optional descriptions; absent values remain absent and presentation completeness is partial. |
| accepted-no-progress | All current items effective state not_started and progress summary zero of total. |
| revision-preserves-progress | Revision 2 changes content/order while stable item IDs retain confirmed progress and new items start not_started. |
| stale-revision-conflict | Candidate based on an old revision is rejected without content or progress changes. |
| malformed-candidate | Wrong types, nulls, or malformed required values are rejected and the prior plan is preserved. |
| duplicate-identifiers | Duplicate item or nested IDs reject the whole candidate. |
| unsafe-resource | Unsafe or credential-bearing URL is rejected; no resource navigation is exposed. |
| opaque-resource | Label-only and bounded opaque reference are preserved as display data without fetch behavior. |
| progress-not-started | Effective state not_started, version 0, complete action permitted. |
| progress-in-progress | Explicit start transition and complete action from in_progress. |
| progress-completion-pending | Confirmed state remains not_started or in_progress while action state is submitting. |
| progress-completed-with-undo | Confirmed completed_by_learner and required undo action. |
| progress-undo-pending | Confirmed completed_by_learner remains visible while undo submits. |
| progress-conflict | Stale progress version preserves the last confirmed state and requires fresh read. |
| deletion-confirmation | Active owned plan with application-level confirmed deletion intent. |
| deletion-conflict | Active plan remains available and fresh-read guidance is required. |
| deletion-recovering | Accepted plan remains visible until durable deletion result is known. |
| deleted-plan | Terminal lifecycle, no current revision, generic unavailable reads, and anti-resurrection marker. |
| unauthorized-plan | No plan reference/content/progress disclosure; presentation maps to unavailable. |
| account-deletion | Immediate access revocation plus bounded purge and retention markers. |

Fixture names may be reused by UI and MCP tests, but each adapter must assert its own boundary. A UI test must not assert database shape, and an MCP test must not require a React component.

## 17. Boundaries with later phases

### Phase 5: application shell and static dashboard

Phase 5 consumes deterministic accepted and view-model fixtures. It implements routes, layout, components, accessible states, non-modal deletion confirmation, undo completion, and the state matrix. It does not change domain meanings, validate raw provider payloads, or add live persistence.

### Phase 6: MCP integration and AI orchestration boundary

Phase 6 maps provider-facing payloads into the canonical candidate and maps domain/application outcomes into exact MCP envelopes, tool names, scopes, lifecycle fields, and compatibility behavior. It must preserve the Phase 2 lease, fencing, idempotency, redaction, ownership, and stale-state rules. It must not move prompt interpretation, curriculum generation, tutoring, or agent orchestration into OpenLearn.

### Phase 7: interactive learning and progress

Phase 7 connects the dashboard actions to durable progress commands, optimistic concurrency, focus/result behavior, and the accepted transition table. It may decide how an explicit start action is exposed, but it cannot treat opening an item or receiving external content as learner confirmation.

### Phase 8: personalization and feedback

Phase 8 may add consent-aware feedback or plan adaptations. Any adaptation must become a new accepted revision under the same owner, revision, stable-ID, and progress-preservation rules. It cannot silently change the meaning of confirmed progress.

### Phase 9: quality, security, accessibility, and performance

Phase 9 verifies the implementation against the bounds, safety behavior, retention assumptions, ownership invariants, accessibility contract, and concurrency outcomes. It may tighten implementation controls based on evidence but cannot weaken the domain contract without a reviewed version change.

### Phase 10: beta, deployment, operations, and community release

Phase 10 operationalizes backups, purge, tombstones, telemetry, audit metadata, recovery, and authenticated handoff in the selected environment. It does not add anonymous production access or bypass the domain/application boundary.

## 18. Remaining open questions outside Phase 4

The following are intentionally deferred because they do not change the canonical domain meaning defined here:

- the exact interchange serialization and version-envelope syntax used by MCP or another adapter;
- exact MCP tool names, argument/result envelopes, scope strings, and protocol compatibility behavior;
- the relational/document schema, ORM, migration tool, transaction library, and PostgreSQL mapping;
- the identity-provider vendor, session library, and account-registration flow;
- the frontend framework implementation and component package distribution model;
- whether a later version supports multiple primary goals, branching plans, collaboration, organizations, sharing, localization, richer resource previews, or adaptive recommendations; and
- legal/privacy verification and operational evidence for the Phase 2 retention schedule, owned by later quality and operations work.

These questions do not permit unvalidated content rendering, provider-specific domain branches, implicit account linking, anonymous production access, stale overwrite, progress spoofing, or deletion resurrection.

## 19. Phase 4 review and exit checklist

Before Phase 4 is marked complete, reviewers must be able to point to:

- a canonical Plan aggregate and explicit Goal, Context, Milestone, Topic, PlanItem, Resource, Revision, and LearnerProgressRecord relationships;
- stable opaque identifiers, identity assignment/preservation rules, and canonical sibling ordering;
- required versus optional fields and deterministic normalization/bounds;
- malformed, incomplete, unknown, duplicate, unsafe, stale, and opaque-content behavior;
- active/deleted plan lifecycle and the separation from Phase 2 operation lifecycle;
- accepted-state semantics, full replacement, revision identity, optimistic concurrency, stale conflicts, and last-accepted-state preservation;
- progress states, learner-only confirmation, allowed actions, undo target semantics, progress versions, and stale-progress conflicts;
- owner scoping, canonical issuer/subject mapping, non-disclosing authorization behavior, and no caller-selected actor;
- dashboard handoff and packages/ui view-model boundaries without UI framework coupling;
- structured error/conflict meanings and safe recovery guidance;
- deletion conflict, immediate access revocation, purge, tombstone, retention, and anti-resurrection rules;
- valid, partial, invalid, revision, progress, ownership, deletion, retention, and deterministic fixture examples;
- explicit handoffs to Phases 5, 6, 7, 8, 9, and 10; and
- no unresolved Phase 4 decision disguised as an implementation detail.

**Phase 4 status at this draft:** Not complete. The contract must pass review and its exit criteria must be verified before the phase document or roadmap changes to Complete.
