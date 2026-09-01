# `@openlearn/application`

The application boundary coordinates authorized plan reads and mutations without depending on a transport, framework, database client, or model provider.

It provides:

- capability-scoped actor contexts for plan reads, plan writes, and progress writes;
- idempotent operation reservation, request fingerprints, cancellation, deadlines, recovery leases, and fencing metadata;
- accepted-plan create, replacement, owner-scoped read, and progress-action use cases;
- capability-scoped personalization consent, bounded feedback, deterministic proposal review, opaque revision handoffs, and purge use cases; and
- ports for durable state, transactions, identity allocation, clocks, operation IDs, and redacted telemetry.

The in-memory state adapter under `src/testing` is deterministic test infrastructure only. Production composition must supply explicit implementations of the application ports; this package does not create anonymous actors or silently fall back to process-local state.

Personalization uses a separate compare-and-set state port. It is intentionally
provider-neutral: accepting a pacing or revision proposal records learner intent
and returns an opaque handoff without changing the accepted plan.

Run its focused checks with:

```powershell
pnpm --filter @openlearn/application test
```
