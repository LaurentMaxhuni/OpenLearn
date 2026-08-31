# OpenLearn

> An open-source, component-driven dashboard for turning AI-generated learning plans into visual, actionable learning experiences through MCP.

> **Project status:** OpenLearn is in early implementation. The framework-neutral `@openlearn/domain` package and Phase 5 static dashboard are available; authentication, persistence, live AI, and MCP integration remain planned.

## What is OpenLearn?

OpenLearn will provide reusable components and a dashboard for plan-shaped content supplied by an external AI client. The AI client interprets the learner's request and calls OpenLearn through the Model Context Protocol (MCP); OpenLearn validates the input, manages the resulting state, and renders goals, topics, progress, and next steps through its dashboard components.

## Planned capabilities

- reusable dashboard layouts and learning-focused UI components;
- a structured learning-plan model that can be rendered consistently;
- an MCP boundary for receiving plans from AI agents;
- visual progress, milestones, topics, and next actions;
- customization points for different subjects, learners, and teaching contexts.

## Current status

The product and architecture boundaries, Phase 3 dashboard UX contract, Phase 4 learning-plan domain package, and Phase 5 static dashboard are recorded. The next phase will connect validated external capabilities through the MCP and AI orchestration boundary.

## Contributing

- [Contributing guide](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security policy](SECURITY.md)
- [Support](SUPPORT.md)
- [Changelog](CHANGELOG.md)

## License

OpenLearn is available under the [MIT License](LICENSE).
