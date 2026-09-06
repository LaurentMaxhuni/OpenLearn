# Observability and alerting

The service exposes a protected Prometheus-compatible endpoint at
`OPENLEARN_METRICS_PATH` (default `/metrics`). In production it requires
`Authorization: Bearer <OPENLEARN_METRICS_TOKEN>`. The endpoint is for the
monitoring network only; do not expose it through the public dashboard.

## Signals

- `/health/live` reports process liveness without checking dependencies.
- `/health/ready` checks PostgreSQL and should be used for traffic and rollout
  decisions.
- `openlearn_http_requests_total` counts requests by method, bounded route
  label, and status.
- `openlearn_application_transitions_total` counts lifecycle outcomes without
  request content.
- `openlearn_http_request_duration_ms_sum` and
  `openlearn_http_requests_recorded` support coarse latency monitoring.
- Every response carries `x-request-id`; application outcomes carry an
  operation ID. Preserve both when opening an incident.

The service also emits redacted transition JSON to stderr by default. It
contains capability, actor class, transition, bounded IDs, and bounded timing
only. It must not contain prompts, bearer tokens, authorization codes, full
plan content, or free-text learner feedback. The platform log sink must enforce
the documented 30-day telemetry and 90-day minimal audit retention windows.

## Beta alerts

Start with these alerts and tune thresholds from observed traffic:

1. readiness failures for two consecutive checks;
2. sustained 5xx responses or MCP request failures;
3. repeated 401/403 spikes, which may indicate identity or origin drift;
4. rate-limit responses above the beta baseline;
5. reconciliation failures or an increasing `reconciling` population;
6. database connection exhaustion, migration failure, or backup failure; and
7. dashboard asset or `/api` proxy failures after a release.

Alert payloads should include environment, build version, route group, status,
request ID when available, and a runbook link. They should not include request
bodies or tokens.

## Rate limits

The service has a bounded per-instance safety limiter for `/mcp` and dashboard
plan routes and returns `x-ratelimit-*` plus `retry-after`. Put the authoritative
shared limit at the ingress/API gateway, keyed by authenticated principal and
source network as appropriate. The in-process limiter is not a substitute for
a shared distributed policy.
