# OpenLearn

> An open-source, component-driven dashboard for turning AI-generated learning plans into visual, actionable learning experiences through MCP.

> **Project status:** OpenLearn has verified local slices through Phase 9: validated plans, MCP/service boundaries, learner progress, personalization controls, and repeatable quality/security/accessibility/performance gates. Production authentication, persistence, live AI, telemetry, and deployment integration remain Phase 10 work.

## What is OpenLearn?

OpenLearn will provide reusable components and a dashboard for plan-shaped content supplied by an external AI client. The AI client interprets the learner's request and calls OpenLearn through the Model Context Protocol (MCP); OpenLearn validates the input, manages the resulting state, and renders goals, topics, progress, and next steps through its dashboard components.

## Current local capabilities

- reusable dashboard layouts and learning-focused UI components;
- a structured learning-plan model that can be rendered consistently;
- an MCP boundary for receiving validated plan-shaped data from AI agents;
- visual progress, milestones, topics, and next actions;
- consent-aware personalization feedback and suggestion review;
- repeatable source, type, test, security, accessibility, resilience, and bundle gates.

## Current status

The product and architecture boundaries, validated domain model, MCP/service composition, learner progress, personalization, and Phase 9 quality evidence are recorded. The next increment is Phase 10: production identity, PostgreSQL persistence, live AI/provider adapters, telemetry, ingress controls, deployment, and beta operations.

## Contributing

- [Contributing guide](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security policy](SECURITY.md)
- [Support](SUPPORT.md)
- [Changelog](CHANGELOG.md)

## License

OpenLearn is available under the [MIT License](LICENSE).
