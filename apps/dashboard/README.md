# OpenLearn dashboard

The dashboard is the browser application carried forward from Phase 5. It provides the navigable `/plans` and `/plans/:planId` shell with deterministic fixtures, browser-local preview progress, consent-aware personalization controls, and a connected mode for authenticated service-backed plans, progress, and deletion.

Use `pnpm --filter @openlearn/dashboard dev` for the deterministic local preview. The **Preview state** selector exposes accepted, partial, loading, empty, invalid, retryable, pending, recovering, completed, and conflict states. Build a hosted dashboard with `VITE_OPENLEARN_MODE=connected`; it calls the authenticated `/api` service boundary and expects the deployment ingress to provide the session cookie and route.

The dashboard does not ship an AI provider or login/callback implementation. The connected AI client remains responsible for conversation and plan generation, while the service validates and persists accepted plan state.
