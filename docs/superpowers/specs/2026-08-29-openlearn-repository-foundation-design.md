# OpenLearn Repository Foundation Design

**Date:** 2026-08-29
**Status:** Approved for implementation after spec review

## Goal

Establish OpenLearn as a credible, welcoming open-source repository before the product implementation begins. The repository will explain the product clearly, set contribution and conduct expectations, document security and support routes, and provide the GitHub community-health files that maintainers and contributors expect.

## Product positioning

OpenLearn is an open-source, component-driven dashboard that connects AI agents through MCP, turns generated learning plans into structured data, and visualizes goals, topics, progress, and next steps as an interactive web experience.

Recommended GitHub About description:

> Open-source dashboard for turning AI-generated learning plans into visual, actionable learning experiences through MCP.

Recommended GitHub topics:

`open-source`, `education`, `learning`, `ai`, `mcp`, `dashboard`, `web-components`, `learning-paths`, `personalized-learning`

The repository will not claim that the dashboard or MCP integration is already implemented. The README will label the project as early-stage and describe the intended product direction honestly.

## Chosen approach

This phase uses a documentation-first foundation. It creates the project’s public contract without selecting a frontend framework, component library, package manager, or MCP SDK prematurely. The next phase can choose those technologies and add the application architecture once the product flows and data model are agreed.

This approach includes the normal open-source repository files and GitHub templates, but does not add fake build commands, a stack-specific CI workflow, generated application code, or unsupported claims about current features.

## Files to create

### Project-level files

- `README.md` — product overview, current status, intended capabilities, high-level MCP/dashboard flow, contribution entry point, a note explaining that local setup waits for the implementation stack, and links to the community documents.
- `LICENSE` — the complete MIT license text, with copyright attribution to `LaurentMaxhuni` for 2026.
- `CONTRIBUTING.md` — how to propose changes, open issues, prepare pull requests, keep changes focused, and follow the project’s quality expectations. It will point contributors to the issue templates and Code of Conduct.
- `CODE_OF_CONDUCT.md` — Contributor Covenant v2.1, with the repository maintainer contact route represented by the project’s GitHub security/support channels rather than an invented personal email address.
- `SECURITY.md` — supported-version policy for this early-stage repository, responsible disclosure guidance, and the GitHub private vulnerability-reporting URL.
- `SUPPORT.md` — guidance for questions, ideas, usage help, and bug reports, routing each category to GitHub Discussions or Issues.
- `CHANGELOG.md` — an initial `Unreleased` section so future user-facing changes have a consistent home.
- `.gitignore` — operating-system, editor, secret, log, dependency, cache, coverage, and common JavaScript/Python build-artifact exclusions suitable for the planned web project while remaining harmless before a stack is selected.
- `.gitattributes` — normalized LF text handling and binary treatment for common image, font, archive, and generated-document formats.
- `.editorconfig` — repository-wide UTF-8, LF, final-newline, whitespace, and two-space defaults, with Markdown code-block-friendly wrapping behavior.

### GitHub community files

- `.github/ISSUE_TEMPLATE/bug_report.md` — reproducible bug reports with environment, expected behavior, actual behavior, reproduction steps, and supporting evidence.
- `.github/ISSUE_TEMPLATE/feature_request.md` — proposals that capture the problem, intended users, desired outcome, and possible implementation considerations without requiring contributors to prescribe the solution.
- `.github/ISSUE_TEMPLATE/config.yml` — directs general questions to Discussions and keeps issue intake focused.
- `.github/PULL_REQUEST_TEMPLATE.md` — change summary, motivation, verification, documentation impact, and checklist for tests, security, and backward compatibility.

No `CODEOWNERS`, Dependabot configuration, CI workflow, or package-manager files will be created in this phase because their correct contents depend on the future maintainer team and implementation stack.

## README content and boundaries

The README will be useful immediately while staying truthful. Its sections will be:

1. Project name and concise value proposition.
2. Early-stage status notice.
3. What OpenLearn is intended to do.
4. The planned flow: an MCP-connected AI agent produces a learning plan; OpenLearn validates and structures it; dashboard components visualize the plan and progress.
5. Planned capabilities, written as goals rather than completed features.
6. Repository status and what kind of contributions are currently useful.
7. Links to contributing, conduct, security, support, and changelog documents.
8. License.

The README will not include commands such as `npm install` or `pnpm dev` until the stack exists. This avoids giving new contributors a setup path that cannot work.

## GitHub metadata

The local repository will contain the recommended About description and topics in the handoff notes, but GitHub’s About description and topics are remote repository settings rather than tracked files. They can be applied through the authenticated GitHub CLI after the local foundation is reviewed. The homepage URL will remain unset until OpenLearn has a published website.

## Validation and acceptance criteria

The foundation is ready when:

- every file listed above exists and contains project-specific guidance rather than unfinished content;
- the README’s product description matches the positioning in this document;
- the MIT license is complete and identifies the 2026 copyright holder;
- all internal Markdown links target files that exist in the repository or the known OpenLearn GitHub pages;
- no documentation presents unimplemented product behavior as available functionality;
- `git diff --check` reports no whitespace errors;
- the initial commit contains only the foundation files and this design record.

## Next phase boundary

After this foundation is accepted, the next design cycle will decide the web stack, component strategy, learning-plan data contract, MCP connection boundary, dashboard information architecture, and test/CI strategy. That work will be separate from this repository-health setup so the public documentation remains stable while implementation choices evolve.
