# Controlled beta feedback

OpenLearn's beta is for validating the bounded learner journey and operating
the authenticated service safely. It is not an invitation to upload sensitive
personal information or unrestricted learner records.

## Who and what to test

Invite a small set of test identities provisioned in an isolated preview
environment. Ask participants to try:

- opening a plan from the authenticated list and direct handoff;
- completing, undoing, and refreshing progress;
- recovering from a stale tab or retryable request;
- reviewing the plan deletion warning and confirming the result; and
- using resources, narrow layouts, keyboard navigation, and the feedback
  controls where enabled.

The connected AI client remains responsible for conversation and plan
generation. A generated plan is untrusted input and must enter through the
existing MCP/domain validation path.

## How to report

Use the [beta feedback issue template](../../.github/ISSUE_TEMPLATE/beta_feedback.md)
for actionable product feedback. Do not include plan text, personal data,
tokens, cookies, screenshots with learner content, or database identifiers.
Use [SECURITY.md](../../SECURITY.md) for a suspected vulnerability and
[SUPPORT.md](../../SUPPORT.md) for account or access help.

Each report should include:

1. the environment (`preview` or the named beta environment);
2. a short neutral description of what the learner expected and saw;
3. the route or feature area;
4. whether the issue is reproducible; and
5. an approximate time and request ID, if available and safe to share.

## Triage

The community owner labels reports as `bug`, `accessibility`, `privacy`,
`security`, `reliability`, or `product-fit`, then assigns severity:

- **Blocker:** data exposure, cross-owner access, destructive corruption, or
  the primary learner journey cannot be completed;
- **High:** repeatable loss of confirmed state, unsafe deletion/recovery, or a
  major accessibility barrier;
- **Medium:** a degraded but recoverable journey or confusing state;
- **Low:** polish, documentation, or isolated non-blocking friction.

Security and privacy reports bypass public triage. Every beta review records
the decision, owner, and whether the finding blocks the next release.
