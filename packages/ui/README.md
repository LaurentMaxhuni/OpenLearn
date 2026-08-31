# OpenLearn UI

`@openlearn/ui` contains presentation-only dashboard components and view models. Components receive explicit props and emit learner intents through callbacks; they do not read domain, database, authentication, AI, or MCP state directly.

The package also owns the shared design tokens and responsive styles used by the Phase 5 dashboard. The dashboard application maps validated domain snapshots into these view models at its application boundary.
