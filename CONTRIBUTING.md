# Contributing to OpenLearn

Thank you for helping improve OpenLearn.

## Before you start

Search [existing issues](https://github.com/LaurentMaxhuni/OpenLearn/issues) before opening a new one. If no issue covers the work, open a focused issue that explains the problem or proposed improvement. For security vulnerabilities, follow the private process in [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Ways to contribute

You can report reproducible bugs, suggest focused improvements, improve documentation, or contribute code. Questions and early ideas are welcome in [GitHub Discussions](https://github.com/LaurentMaxhuni/OpenLearn/discussions).

## Development workflow

Use Node.js 24 and pnpm 10.15.0, matching the versions pinned by the repository. From the repository root, install the workspace dependencies and start the deterministic dashboard preview:

```powershell
pnpm install --frozen-lockfile
pnpm --filter @openlearn/dashboard dev
```

Vite prints the local URL. Open `/plans` to explore the preview; its fixtures and progress stay in the browser. To build and type-check the workspace, run:

```powershell
pnpm run typecheck
pnpm run build
```

The full `pnpm run verify` command also runs the project tests and release checks. For a local PostgreSQL database, start the Compose database with `docker compose up -d database`; set `OPENLEARN_TEST_DATABASE_URL=postgres://openlearn:openlearn@localhost:5432/openlearn` when running persistence tests to enable the real-database integration case. Migration and runtime settings are documented in [service configuration](docs/operations/CONFIGURATION.md). Connected dashboard mode requires a provisioned identity/session boundary and the service environment described there; the repository does not provide provider-specific login or callback screens.

Create a branch from the default branch and keep each change focused. Update documentation when behavior changes, and include the checks you ran in your pull request.

## Pull requests

Use the pull-request template and describe the change, its motivation, and how you verified it. Keep pull requests focused so they are easier to understand and review.

Before opening a pull request, confirm that you:

- follow the [Code of Conduct](CODE_OF_CONDUCT.md);
- keep the scope focused;
- update relevant documentation;
- document verification; and
- do not include secrets in commits.

## Questions

Ask general questions in [GitHub Discussions](https://github.com/LaurentMaxhuni/OpenLearn/discussions). Report bugs through [GitHub Issues](https://github.com/LaurentMaxhuni/OpenLearn/issues). For security concerns, see [SECURITY.md](SECURITY.md).
