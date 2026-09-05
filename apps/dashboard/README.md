# OpenLearn dashboard

The dashboard is the browser application carried forward from Phase 5. It provides the navigable `/plans` and `/plans/:planId` shell with deterministic fixtures, browser-local progress actions, consent-aware personalization controls, and the Phase 9 accessibility and recovery states.

Use `pnpm --filter @openlearn/dashboard dev` for local preview. The **Static preview** selector exposes accepted, partial, loading, empty, invalid, retryable, pending, recovering, completed, and conflict states. The local preview intentionally has no production authentication, server persistence, live AI provider, or remote MCP connection; those adapters are Phase 10 work.
