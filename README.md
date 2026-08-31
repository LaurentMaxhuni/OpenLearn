# OpenLearn

> An open-source, component-driven dashboard for turning AI-generated learning plans into visual, actionable learning experiences through MCP.

> **Project status:** OpenLearn is in early implementation. The framework-neutral domain package, Phase 5 static dashboard, and tested Phase 6 application/MCP/service boundaries are available locally; production authentication, persistence, live AI, and deployment integration remain planned.

## What is OpenLearn?

OpenLearn will provide reusable components and a dashboard for plan-shaped content supplied by an external AI client. The AI client interprets the learner's request and calls OpenLearn through the Model Context Protocol (MCP); OpenLearn validates the input, manages the resulting state, and renders goals, topics, progress, and next steps through its dashboard components.

## Planned capabilities

- reusable dashboard layouts and learning-focused UI components;
- a structured learning-plan model that can be rendered consistently;
- an MCP boundary for receiving plans from AI agents;
- visual progress, milestones, topics, and next actions;
- customization points for different subjects, learners, and teaching contexts.

## Current status

The product and architecture boundaries, Phase 3 dashboard UX contract, Phase 4 learning-plan domain package, Phase 5 static dashboard, and the first tested Phase 6 integration boundary are recorded. The next phase increment will add the production adapters and compatibility work needed to connect validated external capabilities through the MCP and AI orchestration boundary.

## Contributing

- [Contributing guide](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security policy](SECURITY.md)
- [Support](SUPPORT.md)
- [Changelog](CHANGELOG.md)

## License

OpenLearn is available under the [MIT License](LICENSE).
