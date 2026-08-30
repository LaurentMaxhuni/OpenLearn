# OpenLearn Phase 3: Dashboard UX and design-system specification

**Status:** Accepted

**Phase:** 3 — Design system and dashboard UX

**Purpose:** Define the learner-facing information architecture, visual language, responsive behavior, accessibility contract, component states, and presentation boundary that the first OpenLearn dashboard must satisfy.

**Scope:** This specification describes the standalone authenticated dashboard and the reusable presentation surface consumed by it. It does not define a web framework, database schema, MCP tool names, an identity-provider vendor, curriculum generation, or a chat experience.

## 1. Design principles and boundaries

The dashboard is a durable workspace for plan-shaped content supplied by an external AI client. It is not the conversation in which that content was generated. The following principles are normative for the first host:

1. **The next useful action is prominent.** A learner should be able to identify the goal, current progress, and next action before scanning the full outline.
2. **Trust is visible.** The interface distinguishes accepted and validated plan content from pending, partial, invalid, interrupted, or failed external work.
3. **Learner confirmation is distinct from content status.** A plan can be accepted while an item is not started; an operation can be pending while an existing item remains completed by the learner. These signals must never be collapsed into one generic status.
4. **The plan hierarchy remains understandable.** Goal, context, milestones, topics, items, and resources retain their relationships and order in every supported layout.
5. **The dashboard is provider-neutral.** Labels may say that content was supplied externally or validated by OpenLearn, but the interface must not assume ChatGPT, Claude, a particular model, or a particular MCP client.
6. **Presentation does not own domain state.** Components receive explicit view models and emit learner intents. They do not accept database records, MCP requests, bearer tokens, authentication claims, or raw provider payloads.
7. **External content is data.** The dashboard renders allowlisted text, links, and state. It does not execute model-supplied HTML, JavaScript, components, styles, or network instructions.
8. **Recovery preserves useful state.** A failed or stale submission must not make the last accepted plan disappear. When no accepted plan exists, the interface shows an honest empty or recovery state rather than fabricated content.

The Phase 2 ownership and lifecycle decisions remain in force. All dashboard routes are authenticated owner routes in production; an owner is resolved from the canonical issuer and subject mapping; an unauthorized plan response is non-disclosing; accepted plans remain available while the account and plan exist; deletion hides a plan immediately and cannot be undone by a delayed request; and the dashboard does not weaken the bounded MCP operation lifecycle or retention rules.

## 2. Information architecture

### 2.1 Routes and navigation

The first dashboard has two required authenticated routes:

| Route | Role | Required behavior |
| --- | --- | --- |
| `/plans` | Returning-user landing view | Lists the signed-in learner's owned plans and their current visible state. Provides the entry point when no direct handoff is available. |
| `/plans/{plan_id}` | Direct plan handoff and work view | Shows one authorized plan, its goal and context, progress, next action, ordered outline, focused item, resources, and any trust or recovery state. |

The service constructs the direct handoff URL from its configured dashboard origin and route. The UI may display or navigate to a server-supplied safe reference, but it does not construct a URL from an external caller's redirect value. No production route is an anonymous share link.

The shell contains:

- a skip link to the main content;
- a compact brand or product label that does not compete with the plan goal;
- a signed-in account control or session affordance supplied by the host application;
- a primary navigation link to `Plans`; and
- a main landmark containing the current page.

The first release does not require a global search, a dashboard editor, an embedded chat panel, plan reordering, or a content-authoring workflow.

### 2.2 Plans landing view

The `/plans` page is organized in this order:

1. page heading and short orientation text;
2. any page-level trust or recovery message;
3. the plan collection or an explicit empty state; and
4. the recovery or handoff explanation needed for a pending request with no accepted plan.

Each plan summary is a link-like card or list row with a single clear accessible name. It contains:

- the plan title;
- the primary goal or goal summary;
- the visible plan/content state;
- completed and total current items, expressed in plain language;
- the current next action when one exists; and
- a relative or absolute last-updated label with an accessible exact time where applicable.

Plan summaries are ordered by most recently updated first. Equal timestamps use stable `plan_id` order so fixture and UI tests do not depend on incidental database ordering. The collection does not expose plans owned by another internal owner.

When no plan exists, the empty state explains that a connected AI client must supply a plan. It may explain how to return with a plan reference, but it must not present a built-in prompt editor or imply that OpenLearn can generate the curriculum.

### 2.3 Plan detail view

The `/plans/{plan_id}` page uses this information hierarchy:

1. **Trust and recovery status** — whether the displayed plan is accepted, partial, pending, invalid, interrupted, recovering, failed, or unavailable.
2. **Goal and context** — what the learner is trying to learn and the relevant supplied context.
3. **Progress summary** — learner-confirmed item counts and a plain-language completion summary.
4. **Next action** — the most useful current item, with a direct way to open or focus it.
5. **Plan outline** — ordered milestones, topics, and items that show the plan's larger shape.
6. **Focused item** — the selected item's description, status, learner action, and resources.

On wide screens, the outline and focused item may occupy adjacent columns so the learner can move through the plan without losing context. On compact screens, the same content is one ordered flow; no required information is removed merely because the layout stacks.

The goal and context section may be concise when context is absent. It must not invent learner preferences, prior knowledge, time commitments, or outcomes that were not supplied in the accepted plan.

### 2.4 Primary journeys

#### First view after an accepted handoff

1. The learner follows the server-supplied dashboard reference.
2. Authentication completes, if required, and returns the learner to the requested route.
3. The page announces the plan state, goal, progress summary, and next action in that order.
4. The learner can open a focused item, inspect its resources, and use the permitted progress control.

The direct route is useful even if the external conversation is no longer open. The dashboard does not attempt to reconstruct that conversation.

#### Returning to a plan

1. The learner opens `/plans` or a saved plan URL.
2. The current plan state and learner-confirmed progress are visible before the full outline.
3. The learner selects the next action or another ordered item.
4. A refresh or later visit displays the stored result of any completed learner action.

#### Pending or failed replacement with an accepted plan

The existing accepted plan remains the main content. A non-blocking but prominent status region explains that a new submission is pending, recovering, invalid, cancelled, expired, conflicted, or retryable. The status region provides the safe recovery action supplied by the application, such as retrying with a fresh revision or returning to the current plan. It never replaces confirmed learner progress with the new submission's unvalidated content.

#### Pending or failed first submission with no accepted plan

The page shows a pending, recovering, invalid, failed, cancelled, or empty state with an explanation of what can happen next. It does not render a partial candidate as an accepted plan. If a stable operation or dashboard reference exists, that reference may be shown through an application-provided view model; raw request content is not shown.

#### Learner progress action

The focused item exposes a named learner action. While the action is being submitted, the control is disabled with a status announcement and the item remains visible. On success, the item status and summary update together. On a conflict or retryable failure, the control explains that the current state must be refreshed or retried; the UI does not guess a new progress state.

#### Deleted or unauthorized plan

The page shows a non-disclosing unavailable result and a route back to `/plans` where appropriate. It does not reveal whether the plan belonged to another learner, whether it once existed, or whether a stale request attempted to recreate it.

## 3. Trust, content, and learner-state vocabulary

The UI uses separate axes. A component may show one state from each axis at the same time.

### 3.1 Content and operation state

| Internal situation | User-facing state | Meaning | Accepted plan visible? | Primary guidance |
| --- | --- | ---: | --- | --- |
| No accepted plan or data has not been requested | `empty` | There is no plan content to display. | No | Explain how a connected AI client supplies a plan. |
| Initial query is executing | `loading` | The dashboard is retrieving known state. | Unknown | Show structural loading placeholders; do not imply content values. |
| An external mutation is received or executing | `pending` | New work is not yet an accepted plan revision. | Yes, if one exists | Keep the accepted plan visible and explain that new work is pending. |
| A mutation lease is being reconciled | `recovering` | The service is resolving an uncertain operation outcome. | Yes, if one exists | Explain that the current accepted state remains usable while recovery finishes. |
| A validated revision is current | `accepted` | The displayed plan is the current accepted state. | Yes | Allow normal inspection and learner actions. |
| Required structure is valid but optional content is absent | `partial` | The accepted plan is renderable but intentionally incomplete in optional areas. | Yes | Show what is available and identify missing optional detail without fabricating it. |
| Candidate failed validation or includes unsupported/unsafe content | `invalid` | The submission was not accepted. | Yes, if one exists | Explain the bounded validation category and request a corrected submission. |
| A non-validation failure may be retried | `retryable` | No replacement was committed. | Yes, if one exists | Offer a retry or fresh-read action. |
| The caller or transport cancelled before commit | `cancelled` | No replacement was committed. | Yes, if one exists | Keep the accepted state and explain that the operation was cancelled. |
| A deadline or lease ended without a committed replacement | `expired` | No replacement was found. | Yes, if one exists | Keep the accepted state and direct the caller to retry with the same supported recovery rules. |
| The base revision or mutation identity is stale/conflicting | `conflict` | The requested change cannot safely replace current state. | Yes, if one exists | Ask for a fresh read; never auto-merge or overwrite. |
| The transport disconnected or an external request was interrupted | `interrupted` | Outcome is not necessarily known from the browser's perspective. | Yes, if one exists | Show the last accepted state and a recoverable status. |
| The plan was deleted or the owner is not authorized | `unavailable` | The plan cannot be displayed to this actor. | No | Use a non-disclosing message and return to the plan list. |

The UI may use shorter labels in a badge, but accessible text must retain the meaning. “Completed” without a subject is prohibited for content status because it can be confused with learner progress.

The Phase 2 operation states map to presentation states as follows: `received` and `in_progress` map to `pending`; `reconciling` maps to `recovering`; `succeeded` maps to `accepted` when an accepted revision exists; `rejected` maps to `invalid` when validation or authorization prevented a write; `failed_retryable` maps to `retryable`; `cancelled` maps to `cancelled`; `expired` maps to `expired`; and `conflict` maps to `conflict`. The application layer owns this mapping, not `packages/ui`.

### 3.2 Learner-confirmed progress state

The learner axis uses explicit subject labels:

- **Not started** — no learner-confirmed progress action has moved the item forward.
- **In progress** — the learner explicitly started the item but has not confirmed completion.
- **Completed by you** — the learner explicitly confirmed the item complete.
- **Action pending** — a learner action is being submitted; the last confirmed state remains authoritative until the result is accepted.
- **Action needs refresh** — the requested action encountered a stale-progress or retryable error; the UI must not display the unconfirmed target state as fact.

The content state and learner state are independent. For example, “Plan update pending — 4 of 12 items completed by you” is valid and preferred over a single “pending” badge.

## 4. Visual design tokens

The token names below are the framework-neutral design contract. An implementation may expose them as CSS custom properties or another token mechanism, but component behavior must not depend on a particular styling library.

### 4.1 Color roles

Components use semantic roles rather than hard-coded color names. The initial palette establishes a calm, high-contrast neutral foundation with a blue action color and distinct status roles.

| Token | Initial value | Use |
| --- | --- | --- |
| `color.canvas` | `#F7F8FC` | Page background. |
| `color.surface` | `#FFFFFF` | Cards, panels, and focused item surfaces. |
| `color.surface-muted` | `#EEF1F6` | Secondary panels and loading surfaces. |
| `color.text` | `#172033` | Primary text and headings. |
| `color.text-muted` | `#4E5B71` | Supporting text; never the only source of meaning. |
| `color.border` | `#C7CFDD` | Default boundaries and dividers. |
| `color.border-strong` | `#8B97AA` | Boundaries needing additional separation. |
| `color.action` | `#1F52C9` | Links, primary controls, and progress emphasis. |
| `color.action-strong` | `#163F9F` | Hover, active, or high-emphasis action state. |
| `color.success` | `#166534` | Confirmed learner progress and successful recovery. |
| `color.warning` | `#8A4B08` | Partial, pending, or attention-needed state. |
| `color.danger` | `#B42318` | Invalid, failed, or destructive state. |
| `color.info` | `#075985` | Neutral explanatory and recovery state. |
| `color.focus` | `#7C3AED` | Visible focus indicator, paired with sufficient thickness and offset. |

The text/action/status foregrounds are selected for normal-text contrast of at least 4.5:1 against their intended light surfaces; large text must meet at least 3:1; non-text focus indicators and control boundaries must meet at least 3:1 against adjacent colors. Implementation tests must verify the final rendered pairs. Status meaning must also be carried by text, structure, or an icon with an accessible name; color alone is never sufficient.

### 4.2 Typography

Use a system sans-serif stack by default so the first host has no font-download dependency. The implementation may substitute a reviewed font without changing the hierarchy or minimum sizes.

| Token | Size / line height | Use |
| --- | --- | --- |
| `type.display` | 32 / 40 | Goal or page title at wide sizes. |
| `type.heading-1` | 28 / 36 | Primary page heading. |
| `type.heading-2` | 22 / 28 | Major dashboard section. |
| `type.heading-3` | 18 / 24 | Milestone, topic, or focused-item heading. |
| `type.body` | 16 / 24 | Default readable content. |
| `type.body-small` | 14 / 20 | Supporting metadata and compact labels. |
| `type.caption` | 12 / 16 | Supplementary timestamps or status detail only; never essential content alone. |

Body text must remain at least 16 CSS pixels in the default presentation. Long descriptions target 45–80 characters per line on wide screens and reflow naturally on smaller screens. Heading levels follow document hierarchy rather than visual size alone.

### 4.3 Spacing, shape, and elevation

Spacing is based on a 4-pixel unit: `space-1` 4, `space-2` 8, `space-3` 12, `space-4` 16, `space-6` 24, `space-8` 32, `space-12` 48, and `space-16` 64. Components use these values consistently for padding, gaps, and section rhythm.

Shape tokens are `radius-sm` 4, `radius-md` 8, `radius-lg` 12, and `radius-pill` 999. Pills are reserved for short status labels and never used as the only explanation of a state.

Elevation is restrained: `elevation-none`, `elevation-subtle` for separation from the canvas, and `elevation-raised` for an actively focused surface or transient recovery panel. Borders remain present where a boundary is important so elevation is not the only separator.

### 4.4 Motion

Use `motion-fast` 120 ms for local control feedback and `motion-standard` 200 ms for disclosure or layout changes. A longer 320 ms transition may be used for a clearly non-essential page-level emphasis. Motion may use opacity and transform, but it must not be required to discover content, understand status, or complete an action.

When `prefers-reduced-motion` is active, transitions are removed or reduced to an immediate state change. Loading indicators must have a text alternative and must not communicate progress only through animation.

## 5. Responsive composition

The first dashboard supports a minimum 320 CSS-pixel viewport and these layout bands:

| Band | Width | Composition |
| --- | --- | --- |
| Compact | 320–767 px | One column. Trust state, goal/context, progress, next action, outline, focused item, and resources appear in that order. No required interaction depends on hover or a persistent side rail. |
| Medium | 768–1023 px | A readable summary remains full width; outline and focused item may use a two-column composition when both remain usable. The outline may collapse behind an explicit disclosure. |
| Wide | 1024 px and above | Centered content with a readable maximum width. Summary and next action remain prominent; ordered outline and focused item may remain side by side. |

Responsive rules:

- The visual order preserves task priority: trust, goal, progress, next action, outline, focused detail, resources.
- At compact widths, cards become full-width sections and metadata wraps rather than truncating essential text.
- At medium and wide widths, the outline may remain visible while the focused item changes; the focused item must be identifiable to keyboard and assistive technology users.
- Disclosures use a real button with an accessible expanded/collapsed state. Collapsing the outline never removes the current focused item or its action.
- The interface must reflow at 200% text zoom without loss of content or functionality and must remain usable at a 320 CSS-pixel equivalent reflow. No horizontal scrolling is required for ordinary text, controls, or plan content.
- Pointer and touch targets are at least 44 × 44 CSS pixels, including icon buttons and disclosure controls. Adjacent controls have enough spacing to prevent accidental activation.
- The learner action remains adjacent to the focused item's status and is not available only from a hover affordance.
- Keyboard focus and screen-reader order follow the logical content order even when CSS changes visual placement.

## 6. Accessibility acceptance criteria

The implementation must meet WCAG 2.2 AA expectations for the following dashboard-specific behaviors. These are acceptance criteria, not optional polish.

### 6.1 Semantics and names

- The page has one meaningful `h1`, followed by a logical heading hierarchy.
- The shell, primary navigation, main content, status/recovery region, and any complementary outline have semantic landmarks with unique accessible names when more than one landmark of the same type exists.
- Plan outlines use list semantics or equivalent structural relationships. Milestones, topics, and items expose their nesting and order to assistive technology.
- Every plan, item, resource, control, link, disclosure, and status has an accessible name that explains its purpose without relying on visual position.
- Icons that convey meaning have text or an accessible label. Decorative icons are hidden from assistive technology.
- A resource link exposes its destination or action; opening a new context, if ever required, is announced in text.

### 6.2 Keyboard and focus

- A visible skip link moves focus to the main content.
- All navigation, disclosures, item selection, resources, learner actions, retry actions, and recovery controls are keyboard operable.
- The focus order follows the information architecture and does not enter hidden collapsed content.
- Focus indicators are visible on every interactive element, have sufficient contrast, and are not removed by custom styling.
- Focus is not trapped in a card, dialog, disclosure, or loading state. If a future modal is introduced, it must define focus entry, escape, and return behavior separately.
- After a learner action, focus remains on the action or moves to a concise result message according to the view-model state; it must not jump unpredictably to the top of the page.
- A newly shown error or recovery message receives focus only when doing so is necessary to prevent the learner from missing it; otherwise it is announced without disrupting the current task.

### 6.3 Status, contrast, and text

- Pending, invalid, retryable, cancelled, recovering, and learner-confirmed states are conveyed with text and not color alone.
- Async changes use a suitable live region: non-blocking progress/result messages use a status region, while blocking validation or authorization errors use an alert region with concise actionable text.
- The progress summary has a text equivalent such as “4 of 12 items completed by you”; a progress bar is supplementary.
- Text remains readable at increased browser zoom and user text spacing. Content is not clipped, overlapped, or hidden behind fixed controls.
- Error text identifies what the learner can do next and does not expose raw payloads, bearer tokens, full plan content, or internal stack details.
- The final rendered token pairs are verified for the contrast ratios in Section 4.1.

### 6.4 Motion and input modes

- Reduced-motion preferences disable non-essential transitions and do not remove state changes.
- Hover, pointer precision, drag, or animation is never the only way to inspect an item or trigger a permitted learner action.
- Touch, keyboard, and screen-reader use expose the same plan hierarchy and action outcomes.

## 7. Component inventory and state contract

The following component inventory is the minimum reusable surface for the first dashboard. Components may be combined or decomposed during implementation, but each responsibility and state must remain represented.

| Component | Primary responsibility | Required states or behavior |
| --- | --- | --- |
| `AppShell` | Global landmarks, skip link, navigation, and responsive frame. | Loading shell, authenticated content, unavailable session, keyboard focus, compact navigation. |
| `PageHeader` | Page title, orientation, and optional breadcrumb/back affordance. | Normal, loading, unavailable. |
| `PlanCollection` | Ordered list of plan summaries on `/plans`. | Loading, empty, normal, partial/error row, retryable collection error. |
| `PlanSummaryCard` | Link to one plan with goal, state, progress, next action, and updated time. | Accepted, partial, pending, needs attention, completed progress, focus, disabled/unavailable. |
| `TrustStateBanner` | Explains content/operation trust and recovery without hiding accepted content. | Accepted, partial, pending, recovering, invalid, retryable, cancelled, expired, conflict, interrupted, unavailable. |
| `GoalContext` | Shows the accepted goal and supplied context without invention. | Normal, absent optional context, loading, partial. |
| `ProgressSummary` | Shows learner-confirmed counts and plain-language progress. | Not started, in progress, partial, completed by you, loading, action pending, action needs refresh. |
| `NextActionCard` | Highlights the deterministic current item and entry action. | Available, no remaining item, loading, blocked by pending state, unavailable, focus. |
| `PlanOutline` | Presents ordered milestones, topics, and items. | Loading, empty, normal, partial, current item, completed item, collapsed/expanded, keyboard focus. |
| `MilestoneGroup` / `TopicGroup` | Preserves nested outline relationships and disclosure behavior. | Expanded, collapsed, empty optional summary, current descendant, learner-confirmed descendant. |
| `PlanItemDetail` | Shows focused item content, status, action, and resources. | Not started, in progress, completed by you, action pending, action needs refresh, partial details, loading, invalid/unavailable. |
| `ResourceList` | Renders safe plan-supplied resource labels and links. | Empty, one or many resources, opaque/unsupported display label, loading, unavailable link. |
| `LearnerProgressAction` | Emits an explicit learner intent for a permitted item transition. | Enabled, disabled with reason, submitting, confirmed, conflict, retryable error, keyboard/touch focus. |
| `EmptyState` | Explains the absence of a plan or current content. | No plans, no selected item, no resources, no accepted revision. |
| `LoadingState` | Communicates retrieval or action work without fake values. | Page loading, section loading, action pending, reduced motion. |
| `RecoveryPanel` | Explains what can be retried, refreshed, or returned to. | Pending, recovering, interrupted, invalid, retryable, cancelled, expired, conflict. |

### 7.1 State matrix for core surfaces

The following matrix defines the minimum presentation behavior. “Preserve” means retain the last confirmed/accepted value while the new state is explained separately.

| Surface | Loading | Empty | Partial | Invalid/error | Pending/recovering | Learner-confirmed/completed |
| --- | --- | --- | --- | --- | --- | --- |
| Goal/context | Skeleton with no invented text | Explain absent optional context or no accepted plan | Show available fields and identify absent optional detail | Preserve accepted values; show validation/recovery message outside content | Preserve accepted values while new work is unresolved | Unchanged; progress does not alter goal text |
| Progress summary | Placeholder counts | “No learner-confirmed items yet” when a plan exists | Count only current visible items | Preserve last confirmed counts; do not apply failed result | Preserve counts and label action/operation state separately | Show “N of M items completed by you” and completion meaning |
| Next action | Placeholder shape | Explain that an accepted plan is needed or all current items are complete | Choose the first actionable item in accepted order | Preserve prior next action if an accepted plan exists | Preserve prior next action; show pending/recovery state | Point to the first current item not completed by the learner |
| Outline | Structural placeholders | Explain no accepted plan or no outline | Show available accepted hierarchy; do not invent missing nodes | Preserve last accepted outline | Preserve last accepted outline while update status is visible | Mark item states with text and accessible semantics |
| Focused item | Placeholder shape | Explain that no item is selected | Show available accepted detail and missing optional fields | Preserve accepted detail; no candidate content | Preserve accepted detail; action may be disabled while state is unresolved | Show current status and explicit action outcome |
| Resources | Placeholder rows | “No resources supplied” | Show supplied resources only | Preserve accepted resources; omit unsafe/unaccepted content | Preserve accepted resources | Links remain available regardless of item completion unless the application disables them with a reason |
| Progress action | Disabled until item state is known | Hidden or unavailable with explanation | Available only for an accepted current item | Disabled with safe reason | Disabled while the relevant action is unresolved | Enabled for the next permitted transition; confirmed result is announced |

## 8. View-model boundary for `packages/ui`

The UI package receives presentation-specific view models. The exact programming-language types are an implementation concern, but the conceptual boundary is normative.

### 8.1 Plan list view model

```text
PlanListViewModel {
  pageState: "loading" | "ready" | "empty" | "error"
  pageMessage?: DisplayMessage
  plans: PlanSummaryViewModel[]
  recovery?: RecoveryViewModel
}

PlanSummaryViewModel {
  planId: OpaqueId
  href: SafeNavigationReference
  title: DisplayText
  goalSummary: DisplayText
  contentState: "accepted" | "partial" | "pending" | "recovering" | "invalid" | "retryable" | "cancelled" | "expired" | "conflict" | "interrupted"
  progress: ProgressSummaryViewModel
  nextAction?: NextActionViewModel
  updatedAt: DisplayTimestamp
}
```

### 8.2 Plan detail view model

```text
PlanDetailViewModel {
  surfaceState: "loading" | "empty" | "accepted" | "partial" | "pending" | "recovering" | "invalid" | "retryable" | "cancelled" | "expired" | "conflict" | "interrupted" | "unavailable"
  reference?: {
    planId: OpaqueId
    href: SafeNavigationReference
  }
  trust: TrustViewModel
  goal?: GoalViewModel
  context?: ContextViewModel
  progress: ProgressSummaryViewModel
  nextAction?: NextActionViewModel
  outline: OutlineNodeViewModel[]
  focusedItem?: PlanItemViewModel
  operation?: OperationStatusViewModel
  recovery?: RecoveryViewModel
}

ProgressSummaryViewModel {
  completedCount: NonNegativeInteger
  totalCount: NonNegativeInteger
  inProgressCount: NonNegativeInteger
  label: DisplayText
  learnerConfirmed: boolean
}

PlanItemViewModel {
  itemId: OpaqueId
  title: DisplayText
  description?: DisplayText
  positionLabel: DisplayText
  progressState: "not_started" | "in_progress" | "completed_by_learner" | "action_pending" | "action_needs_refresh"
  action?: LearnerActionViewModel
  resources: ResourceViewModel[]
}
```

`DisplayText`, `DisplayTimestamp`, `SafeNavigationReference`, and `OpaqueId` are boundary concepts, not domain entities. The application mapping layer supplies already-safe display values and references. A UI component must not calculate ownership, decide whether a revision is accepted, derive a plan from a pending candidate, reconcile an operation, or infer progress from text.

### 8.3 Component inputs and outputs

Components accept only the fields required for their presentation responsibility. They may receive callbacks or equivalent intents such as:

- select an item by its opaque `itemId`;
- request a permitted learner action for an opaque `itemId`;
- request a safe retry or refresh supplied by the application; and
- navigate to a safe plan reference supplied by the application.

Those callbacks report intent. The UI does not perform persistence, authorization, optimistic concurrency, idempotency, or lifecycle transitions. The application layer resolves the intent and supplies a new view model.

### 8.4 Mapping rules

- The application layer maps accepted domain content, learner progress, operation state, and safe handoff references into the view models.
- The mapping preserves canonical order and stable IDs.
- The mapping calculates progress summaries from stored learner-confirmed progress, not from candidate content or visual selection.
- The mapping selects the next action deterministically: the first current item in canonical outline order that is not completed by the learner, unless the application explicitly marks it unavailable with a reason.
- A pending, rejected, failed, cancelled, expired, or conflicted replacement contributes no content or progress to the accepted view model.
- A partial accepted plan is rendered as partial only when the accepted domain state says its required structure is valid and its optional content is absent.
- Raw validation paths may be reduced to safe display messages; raw request bodies, credentials, internal traces, and provider-specific claims never enter a view model.

## 9. Content and copy rules

The dashboard uses direct, calm language:

| Situation | Preferred wording pattern |
| --- | --- |
| Accepted content | “Plan accepted” or “Validated plan” followed by the goal. |
| Partial accepted content | “Plan accepted with some details missing.” |
| Pending external work | “A plan update is being prepared. Your current plan remains available.” |
| Recovering operation | “We’re checking whether the update completed. Your current plan remains available.” |
| Invalid submission | “This plan update needs attention.” Explain the bounded issue and next action; do not expose raw payload details. |
| Learner progress | “Completed by you” and “4 of 12 items completed by you.” |
| Retryable failure | “The update was not saved. Try again or refresh the current plan.” |
| Conflict | “This plan changed elsewhere. Refresh before trying again.” |
| Empty state | “No plan yet. A connected AI client can provide one for this dashboard.” |

Avoid “the AI completed this,” “the model knows,” “verified learning,” or any wording that implies OpenLearn has judged subject-matter correctness. OpenLearn validates shape, safety, ownership, and state; it does not grade the learner or certify the curriculum.

## 10. Deterministic fixture guidance

Phase 5 and later UI/application tests use fixture-shaped view models derived from contract-shaped data. Fixtures must be deterministic and provider-neutral:

- use stable IDs with a fixture prefix, such as `fixture-plan-basics`, `fixture-milestone-foundations`, and `fixture-item-reading`; production IDs remain opaque and are not inferred from these names;
- freeze timestamps to a documented instant such as `2030-01-02T03:04:05Z` and use explicit relative-time labels in expected output;
- preserve the canonical order in arrays and use stable tie-break ordering;
- use `https://example.test/...` for safe link examples and never real learner URLs;
- include no bearer tokens, credentials, raw prompts, provider account identifiers, or private learner data;
- keep text plain and bounded so snapshots do not depend on HTML parsing or unsafe markup; and
- assert both visible text and semantic state, not only color, CSS class, or screenshot pixels.

The minimum fixture catalog is:

| Fixture | Required coverage |
| --- | --- |
| `accepted-complete` | One goal, context, two ordered milestones, nested topics/items, resources, mixed learner progress, and a deterministic next action. |
| `accepted-partial` | Valid accepted structure with optional descriptions or resources absent; UI identifies the absence without inventing copy. |
| `accepted-no-progress` | Accepted plan whose current items are all not started and whose progress summary is zero of total. |
| `accepted-all-complete` | Every current item is completed by the learner; next-action surface explains that no current item remains. |
| `pending-with-accepted` | Current accepted plan plus pending external replacement; old content and progress remain visible. |
| `recovering-with-accepted` | Current accepted plan plus reconciling/interrupted operation. |
| `invalid-with-accepted` | Validation failure message plus unchanged accepted plan and progress. |
| `retryable-without-accepted` | No plan content, safe retry/recovery state, and no fabricated candidate. |
| `conflict-stale-revision` | Accepted current revision, stale update message, and fresh-read guidance. |
| `progress-action-pending` | Item remains in its last confirmed state while the learner action is submitted. |
| `progress-conflict` | Stale-progress message with no unconfirmed target state displayed. |
| `empty-no-plans` | Authenticated collection with no plans and external-client guidance. |
| `unavailable-deleted-or-unauthorized` | Non-disclosing detail result and plan-list navigation. |
| `compact-layout` / `wide-layout` | The same accepted fixture rendered at supported layout bands with preserved reading and focus order. |

Fixture assertions should cover loading, empty, partial, invalid, error, completed, disabled, focus, pending, interrupted, recovering, cancelled, retryable, and learner-confirmed states wherever the component matrix marks them applicable.

## 11. Validation and review checklist for the UX contract

Before Phase 3 is considered complete, reviewers must be able to point to:

- the two authenticated routes and their first-run/returning-user roles;
- the goal, context, progress, next-action, outline, focused-item, and resource hierarchy;
- compact, medium, and wide layout rules with a 320 CSS-pixel minimum;
- semantic color, type, spacing, shape, elevation, and motion tokens;
- accessible names, landmarks, headings, focus behavior, keyboard operation, contrast thresholds, text zoom/reflow, live-region, and reduced-motion criteria;
- the component inventory and state matrix;
- an explicit separation between operation/content status and learner-confirmed progress;
- view-model types and mapping rules that keep database, MCP, auth, and domain concerns out of `packages/ui`;
- deterministic fixture scenarios for normal, empty, loading, partial, invalid, error, completed, revision, recovery, and progress states; and
- boundaries and handoffs for Phases 4 through 10.

## 12. Handoffs and phase boundaries

### Phase 4: learning-plan domain model

Phase 4 defines the canonical plan entities, stable identifiers, ordering, accepted-state semantics, revision behavior, progress transitions, validation, ownership, deletion, and retention contract that produces the view-model inputs described here. It must preserve the distinction between accepted content and learner-confirmed progress. The UX specification does not choose the domain serialization, database representation, or exact command names.

### Phase 5: application shell and static dashboard

Phase 5 uses deterministic fixtures to implement the shell, routes, component composition, responsive layout, and the complete state matrix without live AI or MCP integration. It verifies the view-model boundary and accessibility behaviors against this specification.

### Phase 6: MCP integration and AI orchestration boundary

Phase 6 maps external protocol requests and operation results into application commands and the safe view-model state. It defines exact MCP names, schemas, envelopes, auth wiring, compatibility behavior, and lifecycle transport handling. It does not move prompt interpretation or curriculum generation into OpenLearn.

### Phase 7: interactive learning and progress

Phase 7 connects learner action controls to durable progress transitions and optimistic concurrency. It must retain the confirmed-state language and must not treat external plan content as learner confirmation.

### Phase 8: personalization and learner feedback

Phase 8 may add consent-aware adaptations or feedback surfaces after reliable progress exists. It must not silently change the meaning of the current plan, ownership, or learner-confirmed progress states defined here.

### Phase 9: quality, security, accessibility, and performance

Phase 9 verifies the final implementation against these accessibility, privacy, security, state, and performance acceptance criteria. It may refine implementation details when evidence requires it, but it must not remove the trust and ownership distinctions.

### Phase 10: beta, deployment, operations, and community release

Phase 10 operationalizes the dashboard and service in the Phase 2 environment model, including authenticated handoff, recovery, redacted observability, deletion, and retention behavior. It does not turn the dashboard into a provider-specific or anonymous sharing product.

## 13. Remaining questions outside Phase 3

These questions are intentionally deferred because they do not change the UX contract above:

- Which OIDC identity-provider vendor and session library will supply the authenticated host session?
- Which exact domain serialization, persistence schema, ORM/query library, and migration tooling will implement the Phase 4 contract?
- Which exact learner API and MCP tool names, payload envelopes, error codes, and protocol compatibility versions will Phase 6 expose?
- Will a future external consumer require a non-React component package or independently versioned distribution?
- Which richer content formats, resource preview types, localization strategy, and typography package should be added after the first host validates the plain-text/resource model?
- Whether OpenLearn should support sharing, organizations, multiple authorities with explicit account linking, collaboration, adaptive recommendations, or other post-MVP product surfaces.

None of these open questions permits anonymous production access, provider-specific UI branches, unvalidated plan rendering, learner-progress spoofing, stale revision overwrite, or weakening of the Phase 2 deletion, retention, handoff, and MCP lifecycle guarantees.
