# OpenLearn product brief

**Status:** Reviewed for the Phase 2 handoff

**Availability:** Planned. This brief defines the intended product boundary; it does not claim that the dashboard, component library, persistence, or MCP integration is implemented.

## Product boundary

OpenLearn is an open-source set of reusable learning-plan components, a dashboard surface, and an external capability boundary. A connected AI client, such as ChatGPT or Claude, interprets a learner's request and supplies plan-shaped content through an MCP connection. OpenLearn receives that input, validates it, keeps the accepted plan and learner state, and renders the result as a visual, actionable dashboard.

An AI-client tool call can ask OpenLearn to create or update a dashboard view. OpenLearn maps accepted input onto its reusable components and state model; it does not invent a new interface or decide what the learner should study for each request.

The connected AI client owns the conversation, the interpretation of the learner's request, and the generation or revision of learning-plan content. OpenLearn does not need to decide what someone should learn, generate a curriculum, or run the AI conversation. Its job is to give the AI client a dependable surface to call and give the learner a clear place to view and act on the resulting plan.

This brief defines the first product boundary. It does not select a web framework, component library, package manager, database, deployment target, identity system, MCP SDK, transport, or exact tool names.

## Problems to solve

### Learner problem

A learner can ask an AI client for a learning plan, but a chat transcript is a poor long-term workspace. The plan can be difficult to scan, its next action can disappear among other messages, and progress can be hard to record consistently. The learner needs a durable, understandable view that answers three questions quickly:

1. What am I trying to learn?
2. Where am I in the plan?
3. What should I do next?

The learner also needs to know whether the displayed plan is accepted, still being prepared, incomplete, or affected by an error. Generated input must not look authoritative merely because it came from an AI client.

### Maintainer and contributor problem

Maintainers and contributors need one reusable product surface between external AI clients and the learner interface. Without that boundary, each integration can invent its own payload shape, rendering logic, state transitions, and failure behavior. That creates provider-specific code, duplicated components, fragile UI states, and difficult support work.

OpenLearn maintainers need a clear way to:

- evolve shared dashboard components without coupling them to one AI provider;
- accept, reject, or represent incomplete external input predictably;
- keep learner-confirmed state separate from pending or untrusted content;
- test normal, empty, partial, invalid, loading, and failure states with deterministic data;
- understand integration failures without collecting more learner content than support requires; and
- give contributors a small, discoverable surface to extend and verify.

## Roles and responsibilities

| Role | Owns | OpenLearn's relationship to it |
| --- | --- | --- |
| Learner | The learning goal, review of the plan, and permitted progress actions | Receives a readable dashboard and can record meaningful state changes |
| Connected AI client | Conversation, interpretation of the request, and plan content generation or revision | Calls OpenLearn's external capability surface with plan-shaped input |
| OpenLearn | Validation, plan state, reusable components, dashboard creation and rendering, and supported learner actions | Provides the stable surface that connects external tool calls to visible state |
| Maintainer or contributor | Contracts, component quality, tests, documentation, and operational support | Keeps the surface provider-neutral, understandable, and recoverable |

## First-run journey

The first-run journey starts outside OpenLearn, in the learner's existing AI conversation.

1. The learner tells the connected AI client what they want to learn and supplies any context they choose to share.
2. The AI client decides to use OpenLearn and calls one or more of its capabilities with the information needed to construct or update a plan view. Those calls may carry plan-shaped content; OpenLearn does not infer the learner's intent or choose the curriculum.
3. OpenLearn treats the input as external and untrusted. It validates the payload and either accepts a renderable plan state or returns an actionable validation result to the calling client.
4. The dashboard presents the accepted plan with its goal, outline, current state, progress summary, and most useful next action.
5. The learner reviews the view, opens the first useful item, and records progress when they complete an item. The first experience makes the connection between the AI-generated content and the learner's own confirmed state visible.
6. If the input is incomplete, invalid, or interrupted, OpenLearn keeps the failure recoverable. The learner sees the recoverable state and what needs attention; the calling client can retry or revise the request without leaving a broken dashboard behind.

The first-run journey is successful when a learner can move from an accepted external request to a usable dashboard view and identify a next action without needing to understand OpenLearn's implementation.

## Returning-user journey

1. The learner opens the saved dashboard view or otherwise returns to their current plan.
2. The dashboard shows the plan goal, current progress, the last known state, and the next permitted action before the learner needs to inspect the full outline.
3. The learner opens the relevant topic, milestone, or plan item and continues from the recorded state.
4. The learner marks a plan item complete, or reverses that action if it was recorded by mistake. These are the initial progress actions; editing plan content and reordering the plan are outside the minimum lovable product.
5. The dashboard recalculates the visible progress and next action from stored domain state. A refresh or later visit must not turn the learner's progress back into a presentation-only flag.
6. If the AI client later submits a revision, the product shows that a new or pending version exists and preserves confirmed learner state according to the versioning rules defined in later phases.

### Interruption and failure behavior

- If the learner leaves while a request is pending, the last accepted plan remains available and the pending work has a visible recovery path.
- If validation fails, OpenLearn does not silently render malformed content as a valid plan. It preserves useful error information for the calling client and shows a learner-readable state where a dashboard view exists.
- If the external client or connection fails, the learner can still inspect the last accepted state. Retry, cancellation, timeout, duplicate-request, and revision behavior are architecture and contract decisions, but they must not create silent data loss.
- If no plan exists, the empty state explains that a connected AI client must provide one. OpenLearn does not replace that client with a built-in chat flow.

## Minimum lovable product

The minimum lovable product is a dependable, provider-neutral surface for one learner to receive, understand, and act on at least one structured learning plan.

It includes:

- a small external capability boundary that accepts plan-shaped input from a connected AI client and creates or updates a dashboard view;
- validation and explicit representation of accepted, pending, incomplete, invalid, and failed plan states;
- reusable components for the plan goal, topics or milestones, plan items, progress, and next action;
- a first dashboard view that makes the plan hierarchy and current action understandable;
- durable plan and learner-progress state sufficient for the returning-user journey;
- learner actions to inspect a plan, mark a plan item complete, and undo an incorrect completion;
- deterministic examples and clear documentation so maintainers can verify the surface without a live AI provider; and
- accessible, responsive behavior and recovery states as acceptance criteria for the eventual implementation.

The minimum lovable product does not require OpenLearn to generate plan content. It requires OpenLearn to make externally supplied content useful, safe to render, and easy to act on.

## First dashboard experience

The first dashboard should make the learner's next decision obvious without hiding the plan's larger shape.

| Dashboard surface | Information or action it must support |
| --- | --- |
| Goal and context | The plan's title or goal, relevant learner-provided context, and the current plan state |
| Progress summary | A plain-language view of completed and remaining work, based on stored state |
| Next action | One prominent, actionable item that follows from the current plan state |
| Plan outline | The ordered topics, milestones, or groups and their relationship to the goal |
| Focused item | Enough plan-supplied detail and resources for the learner to start or resume the selected item |
| Learner action | A clear control to mark the selected item complete and undo that action when needed |
| Trust and recovery state | Whether content is pending, accepted, partial, invalid, failed, or learner-confirmed, with an understandable recovery path |

The dashboard must also have explicit empty, loading, partial, invalid, error, and completed states. It must distinguish learner-confirmed progress from content that is still pending validation or came from an unsuccessful external request. The exact visual language, responsive breakpoints, semantics, and component states are Phase 3 work.

## Success signals

These are observable signals for validating usefulness and maintainability. They are not product-market-fit claims or fixed launch targets.

### Learner signals

- **First-view usefulness:** After an accepted plan is supplied, a usable dashboard view appears without maintainer intervention, and usability sessions show that learners can identify the goal and next action.
- **Plan comprehension:** Learners can explain what the plan contains, where they are, and what a progress state means without reading the external conversation again.
- **Returning usefulness:** A learner can return to the plan, find the current item, record completion, and see the updated state after navigation or a later session.
- **State trust:** Learners can distinguish accepted, pending, partial, invalid, and failed content and do not mistake an unvalidated plan for confirmed state.
- **Recovery:** Learners or the connected AI client can recover from incomplete input, connection interruption, and validation failure without losing the last accepted plan.

### Maintainer and contributor signals

- **Boundary stability:** Components render contract-shaped fixtures without provider-specific branches in the presentation layer.
- **State coverage:** Deterministic fixtures cover normal, empty, loading, partial, invalid, error, completed, and revision-related states before live integrations are relied on.
- **Changeability:** A component or contract change can be reviewed at its owning boundary rather than requiring a rewrite of the external AI client.
- **Supportability:** Maintainers can observe request lifecycle, validation outcomes, failures, and latency without exposing unnecessary learner content.
- **Contributor clarity:** A new contributor can trace representative input to a dashboard state, run the relevant checks, and understand where a change belongs from the documentation.

## Non-goals

OpenLearn's first product cycle does not include:

- interpreting a learner's prompt, selecting a curriculum, generating lesson content, tutoring, grading, or verifying subject-matter correctness;
- hosting or training a language model, owning a ChatGPT or Claude experience, or choosing which external AI client the learner uses;
- a built-in chat interface, prompt editor, agent memory system, or general conversation-orchestration service;
- a general-purpose learning-management system with instructor roles, classrooms, cohorts, assignments, grades, certificates, or attendance;
- a content marketplace, subject-specific content library, or credentialing program;
- social learning, collaboration, messaging, subscriptions, or commercial analytics;
- advanced personalization, recommendations, adaptive pacing, or feedback loops beyond the explicit progress actions in this brief;
- committing Phase 1 to a web framework, component library, package manager, database, deployment model, identity provider, MCP SDK, transport, or exact tool names; or
- treating MCP integration as the product by itself. The product outcome is the reusable dashboard and state surface that an external AI client can use.

## Assumptions

- A connected AI client can discover or be configured to call an MCP-compatible OpenLearn capability surface.
- The AI client can supply structured, or normalizable into a structured form, plan-shaped content. The canonical fields, validation rules, and version envelope belong to Phase 4.
- External plan content is untrusted and can be malformed, incomplete, duplicated, stale, or unavailable.
- The product needs stable identifiers and explicit lifecycle/progress semantics so the dashboard and learner actions refer to the same plan state.
- The first learner experience is individual and subject-neutral. It focuses on one current plan or a small set of plans rather than organizations, cohorts, or shared classrooms.
- The learner can access the dashboard independently of the AI conversation through a link, saved view, or other mechanism that Phase 2 will select.
- The product must retain enough accepted plan state and learner progress to support the returning-user journey, while identity, retention, and deletion rules remain architecture and privacy decisions.
- Maintainers need deterministic fixtures and a provider-neutral component boundary before a live AI client is required for development.
- OpenLearn may expose or receive capabilities through MCP, but its exact connection topology and authorization model are not decided in this phase.

## Open product questions

These questions are intentionally open. Phase 2 should resolve the architecture questions first and carry the remaining contract and UX questions to their owning phases.

### Priority 0: boundary and architecture

1. Is the minimum product a standalone dashboard, an embeddable component surface, or both?
2. What is the smallest external capability set for the first end-to-end flow: plan creation, plan retrieval, progress updates, revision, or another split?
3. How does the calling AI client obtain or return a reference to the learner's dashboard view?
4. What identity and authorization context can OpenLearn rely on when an AI client calls it, and how is that context connected to the learner's dashboard session?
5. What persistence and revision model supports one learner returning to a plan without allowing duplicate or stale requests to overwrite confirmed progress?

### Priority 1: contract and experience

6. Which plan content types are required for the first dashboard, and which can remain opaque plan-supplied content?
7. Which fields may a learner change directly, and which changes must come from a new or revised AI-client submission?
8. How should the calling AI client receive validation errors, pending status, and partial-result information without exposing unnecessary learner data?
9. What privacy, retention, deletion, and observability rules apply to plan content, learner progress, and external request metadata?
10. Which responsive, accessibility, and interaction constraints must the first dashboard support across devices and input modes?

### Priority 2: later product surface

11. When, if ever, should OpenLearn support multiple active plans, sharing, embedding in another product, or collaboration?
12. Which personalization or feedback capabilities deserve a separate product decision after reliable progress state exists?

## Phase 2 handoff

Phase 2 should turn this product boundary into explicit technical decisions in the following order:

1. **Boundary map:** Separate the external AI client from OpenLearn's capability boundary, validation/domain state, persistence, dashboard, and learner-action surfaces.
2. **First delivery shape:** Decide whether the minimum product is standalone, embeddable, or both, and define how a learner reaches the current dashboard view after an external call.
3. **Identity and persistence:** Define the minimum identity, authorization, plan ownership, revision, retention, and recovery assumptions needed for the returning-user journey.
4. **MCP capability lifecycle:** Define discovery, invocation, request state, authorization, timeout, cancellation, duplicate handling, and privacy-aware observability without selecting behavior for the AI client's conversation.
5. **Implementation-neutral contracts:** Specify the interfaces that Phase 3's components and Phase 4's canonical plan model must satisfy, while leaving framework and SDK selection to the architecture record.
6. **Verification boundary:** Define local fixtures, contract checks, and failure-state expectations that let maintainers validate the dashboard without depending on one provider or an undocumented external account.

Phase 2 is complete when those decisions preserve the core promise: an external AI client can provide plan-shaped content, OpenLearn can safely turn it into durable state, and reusable components can present a learner-facing dashboard without taking ownership of curriculum generation or the AI conversation.
