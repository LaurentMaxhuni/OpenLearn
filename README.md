# OpenLearn

> An open-source, component-driven dashboard for turning AI-generated learning plans into visual, actionable learning experiences through MCP.

> **Project status:** OpenLearn has a verified portable beta baseline: validated plans, authenticated service/dashboard boundaries, PostgreSQL persistence, owner mapping, learner progress, deletion/recovery controls, redacted telemetry, deployment images, and repeatable release gates. Provider-specific identity, hosting, backups, and legal approval remain explicit deployment checks.

## What is OpenLearn?

OpenLearn provides reusable components and a dashboard for plan-shaped content supplied by an external AI client. The AI client interprets the learner's request and calls OpenLearn through the Model Context Protocol (MCP); OpenLearn validates the input, manages the resulting state, and renders goals, topics, progress, and next steps through its dashboard components.

## Current local capabilities

- reusable dashboard layouts and learning-focused UI components;
- a structured learning-plan model that can be rendered consistently;
- an MCP boundary for receiving validated plan-shaped data from AI agents;
- visual progress, milestones, topics, and next actions;
- searchable plans with progress filters and summary-first connected loading;
- consent-aware personalization feedback and suggestion review in preview and connected modes;
- authenticated connected dashboard reads, progress actions, and plan deletion;
- provider-neutral OIDC/OAuth verification, PostgreSQL state, operation recovery, and retention maintenance;
- portable service/dashboard images, Compose topology, CI image gates, and deployment runbooks;
- a ChatGPT-ready Streamable HTTP connector path with protected-resource metadata, per-tool OAuth scopes, and same-origin proxy routing;
- repeatable source, type, test, security, accessibility, resilience, and bundle gates.

## Current status

The product and architecture boundaries, validated domain model, MCP/service composition, learner progress, personalization, and Phase 10 release evidence are recorded. The next product decision is a provider-specific beta deployment; OpenLearn intentionally does not ship a built-in AI provider or anonymous production share links.

## Contributing

- [Contributing guide](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security policy](SECURITY.md)
- [Support](SUPPORT.md)
- [Changelog](CHANGELOG.md)

## License

OpenLearn is available under the [MIT License](LICENSE).
