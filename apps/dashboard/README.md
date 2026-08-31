# OpenLearn dashboard

The dashboard is the Phase 5 browser application. It provides the navigable `/plans` and `/plans/:planId` shell with deterministic fixtures so layout, accessibility, and state communication can be reviewed before live integrations are added.

Use `pnpm --filter @openlearn/dashboard dev` for local preview. The **Static preview** selector exposes accepted, partial, loading, empty, invalid, retryable, pending, recovering, completed, and conflict states. No authentication, persistence, AI provider, or MCP connection is expected in this phase.
