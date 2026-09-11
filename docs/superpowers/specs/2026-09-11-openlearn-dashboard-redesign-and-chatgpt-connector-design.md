# OpenLearn dashboard redesign and ChatGPT connector design

**Status:** Approved for implementation from the existing OpenLearn product boundary

**Date:** 2026-09-11

## Design read

Reading this as an overhaul of an existing authenticated learning workspace for
individual learners, with a calm product-instrument language, leaning toward a
native CSS token system and React rather than a marketing-page pattern.

The working dials are:

- `DESIGN_VARIANCE: 6` - enough asymmetry to create hierarchy without making a learner hunt for the next action;
- `MOTION_INTENSITY: 3` - light feedback and focus transitions, no scroll choreography;
- `VISUAL_DENSITY: 5` - a practical daily workspace with fewer, better surfaces.

## Evidence from the current implementation

The dashboard already has the correct product and transport boundaries. It owns
the `/plans` and `/plans/:planId` routes, maps accepted snapshots into
presentation view models, exposes deterministic loading/empty/invalid/recovery
states, and provides connected API and MCP adapters.

The visible debt is primarily presentation debt:

- `packages/ui/styles.css` uses a pale blue canvas, Inter-first typography,
  several radius scales, repeated bordered panels, and a heavy card treatment;
- the static preview selector and connection notices compete with the learner's
  content instead of reading as developer utilities;
- the plan list and detail page give too many surfaces equal visual weight;
- repeated uppercase eyebrows and generic progress/status badges make the
  interface feel assembled from a component kit rather than shaped around the
  learner's next decision.

The redesign preserves routes, primary labels, form semantics, trusted-state
language, keyboard behavior, existing callbacks, and all domain/application
contracts.

## Goals

1. Make the next useful learning action obvious on the first view.
2. Give the plan outline and focused item a stable, readable relationship.
3. Make accepted, pending, invalid, recovering, conflict, and unavailable
   states visually distinct without turning the page into an alert wall.
4. Keep the static preview useful for maintainers while visually subordinate to
   the learner experience.
5. Make the hosted `/mcp` surface connectable from ChatGPT developer mode and
   document the remaining identity-provider requirements clearly.
6. Preserve accessibility, responsive behavior, safe ownership boundaries, and
   browser-local preview behavior.

## Non-goals

- No built-in chat or prompt composer.
- No new anonymous production plan links.
- No route or primary navigation changes.
- No provider-specific identity implementation without a provider decision and
  credentials.
- No embedded ChatGPT widget in the first pass unless the data/tool flow proves
  that the dashboard cannot meet the core handoff outcome.

## Visual system

The page uses one cool neutral family with one brand accent. State colors remain
semantic and are not used as decorative accents.

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#F2F5F8` | page background |
| `surface` | `#FBFCFE` | primary content surface |
| `surface-muted` | `#E8EDF3` | quiet grouping and progress track |
| `ink` | `#172033` | primary text and dark focus surface |
| `text-muted` | `#526176` | supporting text |
| `border` | `#D2DAE5` | structural separators |
| `action` | `#2F63D8` | links, focus controls, progress, selected state |

The shape rule is documented and consistent: content surfaces use a 14px
radius, controls use an 8px radius, and status badges use a pill shape because
they are compact state indicators. Shadows are reserved for the one current
focus surface and are tinted with the ink color.

Typography uses `Aptos`, `Segoe UI Variable`, `Segoe UI`, and the system sans
fallback in that order. Operation and revision metadata may use the system
monospace face. No remote font request or new UI dependency is needed.

## Information architecture and layout

The current information architecture remains:

```text
OpenLearn
└── Plans
    ├── Learning plans list
    └── Plan detail
        ├── trust and recovery state
        ├── goal and context
        ├── progress and next action
        ├── outline
        ├── focused item and resources
        ├── personalization feedback
        └── data controls
```

The plans page becomes a focused workspace rather than a grid of equal cards:

```text
[OpenLearn] Plans                                      [preview utility]
-----------------------------------------------------------------------
Learning plans
Return to the paths you have accepted.

Continue here                                                        
[next item title + context]                              [Open item]

Your plans
[status] plan title                         progress      last activity
[status] plan title                         progress      last activity
```

The detail page uses an asymmetric two-column workspace:

```text
[Back to plans]
[accepted state] Plan title                              [revision]
Short description

[next action, full width, visually strongest surface]

[outline rail]                                  [focused item]
[milestone]                                     [description]
[items]                                         [resources]
                                                 [progress action]

[goal/context] [personalization] [data controls]
```

Below 768px the layout collapses to one column in this order: page header,
trust state, next action, focused item, outline, progress/context, and data
controls. The outline remains expandable and the focused item remains
keyboard-addressable.

## Component changes

- `AppShell` keeps the brand and Plans navigation but uses a compact header. The
  preview control moves into a quiet utility treatment and stays available only
  in the static preview runtime.
- `PageHeader` gains clearer type hierarchy and uses an eyebrow only when it
  communicates actual state or context. Repeated decorative labels are removed.
- `PlanCollection` renders a featured next-action row plus a readable plan list;
  it does not invent a create-plan action because plan creation belongs to the
  connected AI client.
- `DashboardDetail` keeps its existing callbacks and view model contract but
  reorders and groups content around next action, focus, outline, and trust.
- `TrustStateBanner`, `ProgressSummary`, and recovery components use semantic
  state styling with visible text, not color alone.
- Loading states use layout-matched skeleton blocks. Empty and error states keep
  one clear recovery action.

Motion is limited to a short content reveal, selected-item focus feedback, and
progress width transitions. All automatic motion is disabled under
`prefers-reduced-motion: reduce`.

## ChatGPT and MCP contract

The core ChatGPT outcome is: a learner asks ChatGPT to create or revise a
learning plan, receives an accepted OpenLearn dashboard handoff, and can later
read the plan or record progress through the same owner-scoped connection.

The existing tool names remain stable:

| Tool | Purpose | Auth |
| --- | --- | --- |
| `openlearn.create_plan_view` | create or replace an accepted plan view | `plan:write` |
| `openlearn.get_plan_view` | read an authorized accepted plan view | `plan:read` |
| `openlearn.apply_progress_action` | apply a learner progress action | `progress:write` |

The MCP adapter must expose model-facing titles, concise descriptions,
input/output schemas, idempotent annotations, and per-tool auth metadata. The
service must expose a stable `/mcp` Streamable HTTP endpoint, safe CORS/Origin
handling, and OAuth protected-resource metadata when hosted auth is configured.
Unauthenticated requests to protected tools must provide a standards-compatible
`WWW-Authenticate` challenge without disclosing plan existence.

The v1 integration is data-first. The existing dashboard URL returned in the
safe result envelope is the handoff surface. An MCP Apps iframe resource is a
follow-up only if ChatGPT testing demonstrates that a link to the dashboard is
insufficient.

## Deployment contract

The repository continues to deploy as:

```text
TLS ingress
├── /       -> dashboard image
├── /api/*  -> service image
└── /mcp    -> service image
                         ├── PostgreSQL
                         └── configured OIDC/OAuth authority
```

The release documentation must show the exact sequence for install, verify,
image build, migration, service readiness, dashboard origin configuration,
MCP Inspector checks, ChatGPT developer-mode connection, and rollback safety.

Secrets are intentionally deferred until the implementation proves the
repository-side path. The expected hosted values are a real database URL,
OIDC issuer, JWKS URL, MCP audience, dashboard audience, session secret,
metrics token, public dashboard origin, and public MCP origin.

## Acceptance criteria

- Static preview and connected dashboard build with the redesigned hierarchy at
  desktop and mobile widths.
- Existing routes, callbacks, view-model mappings, preview states, progress
  actions, personalization actions, and deletion controls still work.
- Keyboard focus, visible labels, reduced motion, and semantic status roles are
  preserved or improved.
- `openlearn.*` tool names and result contract remain backward compatible.
- MCP tool metadata includes auth/behavior hints and output schemas.
- Protected-resource metadata and unauthorized challenges are tested when the
  service is configured for hosted MCP auth.
- The service still passes liveness, readiness, Origin, rate-limit, and safe
  error tests.
- The release runbook tells the user exactly which provider-specific secrets
  remain before a real hosted connection can be used.
- Fresh lint, typecheck, tests, build, release checks, and a browser smoke test
  provide evidence for the final handoff.

