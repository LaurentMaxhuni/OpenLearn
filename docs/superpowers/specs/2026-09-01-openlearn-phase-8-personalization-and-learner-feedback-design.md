# OpenLearn Phase 8 Personalization and Learner Feedback Design

**Status:** Approved direction; implementation pending spec review

**Goal:** Let a learner provide explicit, bounded feedback and receive explainable personalization suggestions without surrendering control of the accepted learning plan.

## Decision summary

Phase 8 will use a consent-gated, suggestion-only personalization model:

- personalization is disabled by default and enabled explicitly for a plan;
- only learner-confirmed progress and bounded feedback may inform suggestions;
- OpenLearn produces deterministic, structured proposals and explains their basis;
- the learner may accept, reject, pause, disable, correct, or delete the relevant state;
- accepting a proposal never mutates the accepted plan automatically;
- an accepted plan-adjustment proposal becomes an explicit, opaque revision request for the connected AI client, whose generated plan must still pass the existing MCP and domain validation boundaries; and
- no inferred traits, sensitive profiles, raw conversation history, or unrestricted learner notes are introduced.

This preserves the Phase 1 boundary: the connected AI client owns conversation and curriculum generation, while OpenLearn owns validated state, learner controls, and the dashboard surface.

## Scope

The first Phase 8 implementation slice covers one learner and one owned plan at a time. It defines and tests:

- per-plan personalization consent and withdrawal;
- explicit feedback capture for difficulty, pace, and relevance;
- correction and deletion of learner feedback;
- deterministic suggestions for an existing next step, a bounded pacing preference, or a request for a revised plan;
- learner-facing explanations that name the data categories and plan context used;
- proposal review, acceptance, rejection, expiry, and withdrawal states;
- pause and disable behavior that stops new suggestions without changing learner-confirmed progress; and
- privacy-aware retention, deletion, and evaluation rules.

The initial implementation may use the existing deterministic dashboard fixtures and browser adapter for demonstration, but its domain and application contracts must not depend on browser storage or a provider SDK. Production PostgreSQL and live AI-client orchestration remain adapter work behind the existing ports.

## Non-goals

Phase 8 does not:

- automatically reorder, rewrite, delete, or replace an accepted plan;
- generate curriculum, lesson content, grades, or subject-matter judgments inside OpenLearn;
- infer ability, protected characteristics, health, personality, socioeconomic status, or other sensitive traits;
- build a cross-plan learner profile or use feedback for unrelated plans;
- accept unrestricted free-text journals, conversation transcripts, embeddings, or model memory;
- expose raw feedback or personal context in telemetry; or
- introduce social, instructor, cohort, marketplace, advertising, or commercial analytics behavior.

## Design principles

1. **Learner agency:** Suggestions are optional proposals, never silent state changes. A learner can pause or disable the feature and can recover the last accepted plan at any time.
2. **Explicit inputs only:** Personalization uses only consented progress and the bounded feedback types defined here. It does not infer missing facts.
3. **Explainability by construction:** Every proposal carries a short explanation and structured basis categories that can be rendered without exposing raw private data.
4. **Provider-neutrality:** OpenLearn evaluates state and presents controls; the connected AI client remains responsible for interpreting requests and generating revised plan content.
5. **Minimization and reversibility:** Store the smallest records needed for the stated purpose, make decisions reversible where possible, and make withdrawal and deletion effective immediately at the access boundary.
6. **Domain authority:** Consent, feedback, proposal, and decision transitions are validated at the domain/application boundary rather than inferred from UI labels.

## Core concepts and state

### Personalization consent

Consent is scoped to an owner and plan. The default is `disabled`; progress continues to work normally for the dashboard regardless of consent. Suggestion pause is a separate mode available while consent is enabled.

```text
disabled --explicit enable--> enabled <--> paused
                                  |
                                  | disable or withdraw
                                  v
                               revoked
                               ^
                               |
                 explicit new consent version
```

An enabled record contains the consent version and timestamp. Pausing stops evaluation, proposal generation, and new personalization feedback capture while preserving learner-confirmed progress; resuming uses the same consent version. A revoked record stops new personalization work immediately, withdraws unresolved proposals, and prevents the revoked feedback from being used in future evaluation. Re-enabling after revocation starts a new consent version and never resurrects records that were deleted during withdrawal.

The consent surface must state plainly:

- which inputs are used: confirmed progress and the selected plan's explicit feedback;
- what may result: suggestions or a request for the learner to ask the connected AI client for a revised plan;
- what will not happen: no automatic plan changes; and
- how to pause, disable, correct, and delete the data.

### Explicit learner feedback

Feedback is always attached to the owner and plan, and may optionally target one current item. The first slice supports only these bounded values:

| Feedback area | Allowed values | Example learner meaning |
| --- | --- | --- |
| Difficulty | `too_easy`, `about_right`, `too_hard` | “This item’s challenge is…” |
| Pace | `too_slow`, `about_right`, `too_fast` | “The plan is moving…” |
| Relevance | `relevant`, `not_relevant` | “This item still supports my goal…” |

Each record includes an opaque feedback ID, owner ID, plan ID, optional current item ID, feedback area/value, creation timestamp, consent version, and correction/deletion status. The first slice does not store unrestricted notes. A correction creates a new bounded value linked to the superseded feedback ID; it does not edit history in place. Deleted feedback is logically unavailable immediately and is not eligible for future proposals.

Feedback is accepted only when personalization is enabled for the same owner and plan. The current plan revision and item membership are checked at capture time. Feedback cannot be submitted for another owner, another plan, a deleted plan, or a missing item.

### Personalization proposal

A proposal is a reviewable recommendation, not a plan mutation. The first proposal kinds are:

- `recommend_existing_next_step`: point the learner to an existing item already in the accepted plan;
- `suggest_pacing_preference`: propose a bounded pacing preference for the learner to consider; or
- `request_plan_revision`: prepare an opaque request for the connected AI client to generate a revised plan using the learner-approved preference.

Every proposal contains:

- an opaque proposal ID, owner ID, plan ID, and source revision ID;
- one structured proposal kind and bounded parameters;
- a learner-readable explanation;
- a non-sensitive basis such as `confirmed_progress`, `difficulty_feedback`, `pace_feedback`, or `relevance_feedback`;
- creation and expiry timestamps; and
- one status: `proposed`, `accepted`, `rejected`, `withdrawn`, or `expired`.

Only `proposed` proposals can be accepted or rejected. Consent withdrawal changes unresolved proposals to `withdrawn`. An expired proposal cannot be revived; a fresh evaluation must produce a new proposal under the current consent version.

An accepted `recommend_existing_next_step` proposal may focus an existing item or update a next-step presentation state. An accepted pacing or revision proposal records learner intent and returns an opaque handoff for the connected AI client. The accepted plan remains unchanged until a separately submitted, validated plan revision is accepted through the existing domain/MCP path.

## Architecture and data flow

The boundaries remain:

```text
learner control
      |
      v
dashboard view model -> application use case -> domain validation
      ^                                      |
      |                                      v
proposal explanation <- deterministic evaluator <- consented progress + bounded feedback
      |
      v
accept/reject/withdraw -> optional opaque revision handoff -> connected AI client
                                                        |
                                                        v
                                  existing MCP validation -> accepted plan revision
```

### Domain boundary

The domain owns the value shapes and transition rules for consent, feedback, proposals, and proposal decisions. It must enforce:

- owner/plan/item/revision relationships;
- consent-version matching;
- allowed feedback areas and values;
- proposal source revision and expiry rules;
- valid proposal state transitions;
- no mutation of learner progress or accepted plan content as a side effect of proposal evaluation; and
- atomic failure behavior for stale, unauthorized, deleted, malformed, or already-decided records.

The evaluator consumes a read-only projection of consented inputs and returns either a bounded proposal or no proposal. It cannot read raw conversation data, unrelated plans, unconsented feedback, or inferred profile attributes.

### Application boundary

Application use cases provide authorized operations for:

- enabling, viewing, and revoking plan-scoped consent;
- recording, correcting, and deleting bounded feedback;
- evaluating or listing current proposals;
- accepting or rejecting a proposal with an expected proposal version; and
- creating an opaque revision-request handoff after learner acceptance.

Mutations require the existing owner and capability checks, an idempotency key where the operation can cross a service boundary, and optimistic version checks. A stale decision returns a conflict and leaves the proposal and accepted plan unchanged.

### Dashboard boundary

The UI presents consent before the first personalization use, labels personalized content as a suggestion, and renders the structured explanation and basis categories. It must never turn a proposal into a confirmed plan revision merely because it was displayed or accepted locally.

The first browser implementation may persist the minimal records through an injected adapter like the Phase 7 progress store, but it must not persist plan content, raw conversation data, credentials, or hidden model state in the personalization key.

### AI/MCP boundary

The connected AI client may receive an opaque, learner-approved revision request and the bounded preference needed to interpret it. It remains responsible for conversation and curriculum generation. Any returned plan-shaped content is untrusted and must pass the existing Phase 6 MCP and Phase 4 domain validation path. A proposal or revision request cannot authorize a direct write around that path.

## Learner agency and UX behavior

The first dashboard experience adds these explicit controls:

- **Enable suggestions:** a clear consent explanation and plan scope;
- **Why this suggestion?** a concise explanation and basis categories;
- **Accept** or **Not useful:** a proposal decision with confirmed status;
- **Pause suggestions:** temporarily stops evaluation while preserving current confirmed progress;
- **Disable personalization:** revokes consent, withdraws unresolved proposals, and begins the defined deletion path;
- **That feedback is wrong:** corrects or deletes the specific feedback record; and
- **Refresh/recover:** re-reads current state after conflicts or uncertain external outcomes.

The UI distinguishes:

- learner-confirmed progress, which remains authoritative;
- a proposed adjustment, which is not yet a plan change;
- an accepted revision request, which is awaiting a separately validated plan update; and
- a rejected, withdrawn, expired, or conflicted proposal, which cannot be presented as active.

All controls require accessible names, keyboard operation, visible focus, readable status announcements, and reduced-motion compatibility. Explanations must remain understandable without color alone or hidden hover content.

## Data governance

The Phase 2 retention baseline applies:

- immediate logical access revocation on plan/account deletion;
- primary feedback, consent, proposal, and revision-request data purged within 24 hours of deletion;
- backup copies expired or scrubbed within 35 days;
- redacted operational telemetry retained for 30 days; and
- minimal security/ownership audit metadata retained for 90 days.

Consent withdrawal stops use immediately. Unresolved proposals are withdrawn immediately. Feedback and personalization records are logically deleted on withdrawal and physically purged from primary storage within 24 hours. Re-enabling before physical purge still starts a new consent version and cannot restore or reuse the deleted records. The implementation must make this lifecycle observable without exposing feedback content.

Data minimization rules:

- store stable opaque IDs and bounded enum values, not raw conversation excerpts;
- keep proposal explanations derived from basis categories rather than copying feedback text;
- do not create a cross-plan profile in the first slice;
- do not send raw feedback to telemetry or logs;
- avoid collecting data not needed to evaluate the current plan; and
- ensure deletion cannot be undone by a stale worker, retry, backup restore, or late plan revision.

## Evaluation criteria

Phase 8 is useful only if personalization improves clarity without reducing agency. Evaluation covers:

- **Usefulness:** learners can identify whether a suggestion helps and can find an existing next step;
- **Explainability:** learners can name the data categories behind a suggestion without reading implementation details;
- **Agency:** no accepted proposal changes the plan automatically, and pause/disable/reject/correct paths work;
- **Accuracy:** suggestions reference only current-plan items and consented evidence;
- **Safety:** no sensitive or cross-plan inference is surfaced, and deleted/withdrawn records are not reused;
- **Recovery:** stale decisions and uncertain handoffs preserve the last accepted plan; and
- **Supportability:** telemetry can measure proposal outcomes and failure categories without collecting raw learner content.

Recommended review signals are proposal acceptance, rejection, correction, withdrawal, expiry, repeated disablement, stale conflicts, and learner explanation-comprehension checks. These are quality signals, not a license to optimize against individual learners or infer protected traits.

## Verification requirements

Tests and review evidence must cover:

- consent is disabled by default and gates feedback use;
- enable, revoke, re-enable, and deletion transitions preserve consent-version rules;
- invalid owner, plan, item, revision, feedback, and proposal relationships fail atomically;
- only the three bounded feedback areas and values are accepted;
- corrections and deletions remove records from future evaluation;
- evaluators ignore unconsented, deleted, withdrawn, cross-plan, and unrelated data;
- proposals contain explanations and basis categories without raw feedback or plan content leakage;
- proposal accept/reject/withdraw/expire transitions honor optimistic conflicts and idempotency;
- accepted proposals do not mutate the accepted plan or learner progress;
- revision handoffs are opaque and remain subject to existing MCP/domain validation;
- browser storage failures and malformed records fail closed;
- dashboard controls and status announcements satisfy the existing accessibility contract; and
- retention/deletion behavior cannot resurrect personalization data through retries, backups, or stale writes.

The existing domain, application, dashboard, UI, MCP, service, and full verification suites must remain green.

## Exit criteria

Phase 8 can close when:

- consent and retention rules are documented and implemented at the owning boundaries;
- bounded explicit feedback can be captured, corrected, deleted, and excluded after withdrawal;
- deterministic suggestions are explainable, current-plan-scoped, and suggestion-only;
- learner accept, reject, pause, disable, correction, and recovery paths are available and accessible;
- accepted plan state is never changed without a separate validated plan revision;
- evaluation signals cover usefulness, safety, explainability, and learner agency; and
- the resulting contracts are ready for Phase 9 quality, security, accessibility, and performance verification.

## Deferred work

The following remain outside this first Phase 8 implementation slice:

- automatic adaptive plan changes;
- unrestricted learner notes or conversation-memory features;
- cross-plan or organization-wide personalization;
- inferred learner profiles or sensitive trait modeling;
- direct curriculum generation inside OpenLearn;
- production personalization persistence and live AI/MCP revision orchestration beyond the existing adapter ports; and
- advanced experimentation or automated recommendation optimization.

## Handoff

After this design is approved, the implementation plan should decompose the work into domain contracts, application use cases, deterministic evaluator rules, storage/retention adapters, dashboard view models/components, and end-to-end verification without changing the existing Phase 4, Phase 6, or Phase 7 safety boundaries.
