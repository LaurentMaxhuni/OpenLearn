# OpenLearn Repository Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish OpenLearn as a credible, welcoming MIT-licensed open-source repository with truthful product documentation, community-health files, contribution guidance, and GitHub issue/PR intake.

**Architecture:** Use a documentation-first repository foundation that is independent of the future frontend framework, package manager, component library, and MCP SDK. The README describes the planned AI-to-dashboard flow without claiming unimplemented behavior; community files define how contributors interact with the project; GitHub metadata is applied separately because it is remote repository configuration.

**Tech Stack:** Git, Markdown, GitHub community-health files, `.editorconfig`, `.gitattributes`, and `.gitignore`. No application runtime or package manager is selected in this phase.

**Spec:** `docs/superpowers/specs/2026-08-29-openlearn-repository-foundation-design.md`

## Global Constraints

- Use the MIT license with `Copyright (c) 2026 LaurentMaxhuni`.
- Describe OpenLearn as early-stage; do not present the dashboard or MCP integration as implemented.
- Keep README setup instructions stack-neutral until the application stack is selected.
- Use the repository URL `https://github.com/LaurentMaxhuni/OpenLearn` for GitHub links.
- Use GitHub Discussions for general questions and GitHub Issues for reproducible bugs and focused feature proposals.
- Do not add a CI workflow, package-manager files, `CODEOWNERS`, Dependabot configuration, or generated application code in this phase.
- Preserve the existing design commit and keep each implementation task independently reviewable.

## File map

| File | Responsibility |
| --- | --- |
| `README.md` | Explain the product, current status, planned MCP/dashboard flow, contribution entry points, and license. |
| `LICENSE` | Grant the MIT license and identify the copyright holder. |
| `.gitignore` | Exclude local, secret, dependency, cache, coverage, and common web-project build artifacts. |
| `.gitattributes` | Normalize text files to LF and classify common binary files. |
| `.editorconfig` | Set repository-wide editor defaults. |
| `CONTRIBUTING.md` | Define issue, branch, change, verification, and pull-request expectations. |
| `CODE_OF_CONDUCT.md` | Adopt Contributor Covenant v2.1 and provide a GitHub-based reporting route. |
| `SECURITY.md` | Explain supported versions and private vulnerability reporting. |
| `SUPPORT.md` | Route questions, bugs, ideas, and security reports to the right channel. |
| `CHANGELOG.md` | Start the project’s user-facing change history with an `Unreleased` section. |
| `.github/ISSUE_TEMPLATE/bug_report.md` | Collect reproducible bug reports. |
| `.github/ISSUE_TEMPLATE/feature_request.md` | Collect problem- and outcome-focused feature proposals. |
| `.github/ISSUE_TEMPLATE/config.yml` | Route general questions and security reports away from regular issues. |
| `.github/PULL_REQUEST_TEMPLATE.md` | Collect change context and verification details from contributors. |

---

### Task 1: Create project identity and repository defaults

**Files:**
- Create: `README.md`
- Create: `LICENSE`
- Create: `.gitignore`
- Create: `.gitattributes`
- Create: `.editorconfig`

**Interfaces:**
- Consumes: The approved product positioning and file boundaries in `docs/superpowers/specs/2026-08-29-openlearn-repository-foundation-design.md`.
- Produces: The README links consumed by Tasks 2 and 3, and repository-wide text/ignore rules consumed by every later change.

- [ ] **Step 1: Write the README product identity and status notice**

  Start `README.md` with:

  ```markdown
  # OpenLearn

  > An open-source, component-driven dashboard for turning AI-generated learning plans into visual, actionable learning experiences through MCP.

  > **Project status:** OpenLearn is in early setup. The application, dashboard, and MCP integration are planned and are not yet available.
  ```

- [ ] **Step 2: Add the README vision and planned flow**

  Add a `## What is OpenLearn?` section explaining that OpenLearn will provide reusable template code and components for a learning dashboard. State that an AI agent connected through the Model Context Protocol (MCP) will generate a learning plan, OpenLearn will validate and structure the plan, and dashboard components will visualize goals, topics, progress, and next steps.

  Add a `## Planned capabilities` section with these honest, future-oriented bullets:

  ```markdown
  - reusable dashboard layouts and learning-focused UI components;
  - a structured learning-plan model that can be rendered consistently;
  - an MCP boundary for receiving plans from AI agents;
  - visual progress, milestones, topics, and next actions;
  - customization points for different subjects, learners, and teaching contexts.
  ```

  Add `## Current status` with the statement that the repository is being prepared before implementation, and that the next design phase will choose the web stack, component strategy, learning-plan contract, MCP connection boundary, dashboard information architecture, and test/CI strategy. Do not include install, build, or development commands because no runtime stack exists yet.

- [ ] **Step 3: Add README contribution and license links**

  Add `## Contributing` with links to:

  ```markdown
  - [Contributing guide](CONTRIBUTING.md)
  - [Code of Conduct](CODE_OF_CONDUCT.md)
  - [Security policy](SECURITY.md)
  - [Support](SUPPORT.md)
  - [Changelog](CHANGELOG.md)
  ```

  Add `## License` with `OpenLearn is available under the [MIT License](LICENSE).` Ensure every linked local file is created by the end of Tasks 2 and 3.

- [ ] **Step 4: Add the complete MIT license**

  Create `LICENSE` using the complete standard MIT text, with this attribution line immediately below the title:

  ```text
  Copyright (c) 2026 LaurentMaxhuni
  ```

  Keep the permission grant, conditions, and warranty disclaimer complete and unmodified apart from the attribution line.

- [ ] **Step 5: Add stack-neutral repository defaults**

  Create `.gitignore` with the following groups and entries:

  ```gitignore
  # Operating system files
  .DS_Store
  Thumbs.db
  desktop.ini

  # Editors and IDEs
  .idea/
  .vscode/
  *.swp
  *.swo

  # Local environment and secrets
  .env
  .env.*
  !.env.example
  *.pem
  *.key

  # Logs
  *.log
  npm-debug.log*
  yarn-debug.log*
  yarn-error.log*
  pnpm-debug.log*

  # JavaScript and web tooling
  node_modules/
  .npm/
  .pnpm-store/
  .next/
  .nuxt/
  .svelte-kit/
  .turbo/
  .cache/
  .vercel/
  dist/
  build/
  out/
  coverage/
  *.tsbuildinfo

  # Python tooling that may support MCP utilities
  __pycache__/
  *.py[cod]
  .pytest_cache/
  .mypy_cache/
  .ruff_cache/
  .venv/
  venv/
  env/
  ```

  Create `.gitattributes` with LF normalization and binary patterns:

  ```gitattributes
  * text=auto eol=lf

  *.png binary
  *.jpg binary
  *.jpeg binary
  *.gif binary
  *.webp binary
  *.ico binary
  *.woff binary
  *.woff2 binary
  *.ttf binary
  *.otf binary
  *.zip binary
  *.gz binary
  *.pdf binary
  ```

  Create `.editorconfig` with `root = true`, UTF-8, LF, final newline, trimmed trailing whitespace, two-space indentation, and Markdown wrapping disabled:

  ```editorconfig
  root = true

  [*]
  charset = utf-8
  end_of_line = lf
  insert_final_newline = true
  trim_trailing_whitespace = true
  indent_style = space
  indent_size = 2

  [*.md]
  trim_trailing_whitespace = false
  ```

- [ ] **Step 6: Validate Task 1 and commit it**

  Run:

  ```powershell
  git diff --check
  $taskOneFiles = @('README.md', 'LICENSE', '.gitignore', '.gitattributes', '.editorconfig')
  $missing = $taskOneFiles | Where-Object { -not (Test-Path -LiteralPath $_) }
  if ($missing) { throw "Missing Task 1 files: $($missing -join ', ')" }
  ```

  Expected: no whitespace errors and no missing-file exception. Commit with:

  ```bash
  git add README.md LICENSE .gitignore .gitattributes .editorconfig
  git commit -m "chore: add OpenLearn project foundation"
  ```

---

### Task 2: Add community policies and contributor guidance

**Files:**
- Create: `CONTRIBUTING.md`
- Create: `CODE_OF_CONDUCT.md`
- Create: `SECURITY.md`
- Create: `SUPPORT.md`
- Create: `CHANGELOG.md`

**Interfaces:**
- Consumes: The project identity and local links from `README.md`.
- Produces: The policy pages linked by the README and referenced by GitHub templates in Task 3.

- [ ] **Step 1: Write `CONTRIBUTING.md`**

  Include these sections: `Before you start`, `Ways to contribute`, `Development workflow`, `Pull requests`, and `Questions`. Explain that contributors should search existing issues, open a focused issue when needed, create a branch from the current default branch, keep changes small and understandable, document verification, update documentation when behavior changes, and use the pull-request template. State that stack-specific setup instructions will be added when the application exists.

  Link `Questions` to `https://github.com/LaurentMaxhuni/OpenLearn/discussions`, bugs to `https://github.com/LaurentMaxhuni/OpenLearn/issues`, and security reports to `SECURITY.md`. Include a concise checklist requiring the Code of Conduct, focused scope, documentation, verification, and no secrets in commits.

- [ ] **Step 2: Add Contributor Covenant v2.1**

  Create `CODE_OF_CONDUCT.md` using the complete Contributor Covenant v2.1 text. Set the project name to OpenLearn. Replace the bracketed enforcement-contact field in the template with this concrete route: `For private conduct concerns, contact the maintainers through the repository's private GitHub reporting channel: https://github.com/LaurentMaxhuni/OpenLearn/security/advisories/new.` Keep the code linked to `SECURITY.md` for the distinction between conduct concerns and security vulnerabilities.

- [ ] **Step 3: Write `SECURITY.md`**

  Include:

  ```markdown
  ## Supported versions

  OpenLearn is in early setup. Only the current default branch is supported at this time.

  ## Reporting a vulnerability

  Do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability reporting channel:

  https://github.com/LaurentMaxhuni/OpenLearn/security/advisories/new

  Include the affected commit or version, reproduction steps, impact, and any suggested mitigation. The maintainers will acknowledge the report, investigate it privately, and coordinate disclosure after a fix or mitigation is available.
  ```

  Add a note that ordinary bugs belong in the bug-report template, not the private security channel.

- [ ] **Step 4: Write `SUPPORT.md`**

  Route channels explicitly:

  - general questions and usage help: [GitHub Discussions](https://github.com/LaurentMaxhuni/OpenLearn/discussions);
  - reproducible defects: [Bug report](https://github.com/LaurentMaxhuni/OpenLearn/issues/new?template=bug_report.md);
  - ideas and proposed capabilities: [Feature request](https://github.com/LaurentMaxhuni/OpenLearn/issues/new?template=feature_request.md) or Discussions for early exploration;
  - vulnerabilities: the private process in `SECURITY.md`.

  Ask users to include context, expected behavior, actual behavior, and relevant logs without sharing credentials or personal data.

- [ ] **Step 5: Start `CHANGELOG.md`**

  Use this exact initial structure:

  ```markdown
  # Changelog

  All notable changes to OpenLearn will be documented here.

  ## [Unreleased]

  ### Added

  - Established the initial open-source repository foundation.
  ```

- [ ] **Step 6: Validate Task 2 and commit it**

  Run:

  ```powershell
  $policyFiles = @('CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'SECURITY.md', 'SUPPORT.md', 'CHANGELOG.md')
  $missing = $policyFiles | Where-Object { -not (Test-Path -LiteralPath $_) }
  if ($missing) { throw "Missing Task 2 files: $($missing -join ', ')" }
  $markers = @('T' + 'BD', 'TO' + 'DO', 'INSERT ' + 'CONTACT METHOD', 'fill ' + 'in', 'implement ' + 'later')
  $matches = Select-String -Path CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, SUPPORT.md, CHANGELOG.md -Pattern $markers
  if ($matches) { $matches | Format-Table; throw 'Unfinished content markers found in Task 2 policy files.' }
  ```

  Expected: no missing-file exception and no unfinished-content matches. Commit with:

  ```bash
  git add CONTRIBUTING.md CODE_OF_CONDUCT.md SECURITY.md SUPPORT.md CHANGELOG.md
  git commit -m "docs: add OpenLearn community policies"
  ```

---

### Task 3: Add GitHub issue and pull-request intake

**Files:**
- Create: `.github/ISSUE_TEMPLATE/bug_report.md`
- Create: `.github/ISSUE_TEMPLATE/feature_request.md`
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/PULL_REQUEST_TEMPLATE.md`

**Interfaces:**
- Consumes: The support, security, and contribution routes from Tasks 1 and 2.
- Produces: GitHub forms and a pull-request checklist that link to the repository’s existing community documentation.

- [ ] **Step 1: Create the bug-report template**

  Use this front matter:

  ```yaml
  ---
  name: Bug report
  about: Report a reproducible problem in OpenLearn
  title: "[Bug]: "
  labels: bug
  assignees: ''
  ---
  ```

  Add headings for `Describe the problem`, `Steps to reproduce`, `Expected behavior`, `Actual behavior`, `Environment`, `Supporting information`, and `Checklist`. The checklist must remind reporters to remove secrets and confirm that they searched existing issues. Include HTML comments that tell reporters what useful details belong under each heading without appearing in the rendered issue.

- [ ] **Step 2: Create the feature-request template**

  Use front matter with `name: Feature request`, `about: Propose an improvement to OpenLearn`, `title: "[Feature]: "`, `labels: enhancement`, and an empty `assignees` value. Add headings for `Problem`, `Desired outcome`, `Who benefits`, `Possible direction`, `Alternatives considered`, and `Checklist`. Ask contributors to focus on the user problem and outcome rather than requiring a particular technology.

- [ ] **Step 3: Create the issue-template configuration**

  Create `.github/ISSUE_TEMPLATE/config.yml` with:

  ```yaml
  blank_issues_enabled: false
  contact_links:
    - name: Questions and ideas
      url: https://github.com/LaurentMaxhuni/OpenLearn/discussions
      about: Ask questions or explore an idea before opening a tracked issue.
    - name: Security vulnerability
      url: https://github.com/LaurentMaxhuni/OpenLearn/security/advisories/new
      about: Report security vulnerabilities privately.
  ```

- [ ] **Step 4: Create the pull-request template**

  Add headings for `Summary`, `Motivation`, `What changed`, `Verification`, `Documentation`, and `Notes for reviewers`. Add this checklist:

  ```markdown
  - [ ] I have read and followed the [Contributing Guide](../CONTRIBUTING.md).
  - [ ] I have followed the [Code of Conduct](../CODE_OF_CONDUCT.md).
  - [ ] I have documented how I verified this change, or explained why verification is not applicable.
  - [ ] I have updated user-facing documentation when needed.
  - [ ] I have not included credentials, tokens, or other secrets.
  - [ ] I have considered security, accessibility, and backward compatibility.
  ```

- [ ] **Step 5: Validate Task 3 and commit it**

  Run:

  ```powershell
  $githubFiles = @(
    '.github/ISSUE_TEMPLATE/bug_report.md',
    '.github/ISSUE_TEMPLATE/feature_request.md',
    '.github/ISSUE_TEMPLATE/config.yml',
    '.github/PULL_REQUEST_TEMPLATE.md'
  )
  $missing = $githubFiles | Where-Object { -not (Test-Path -LiteralPath $_) }
  if ($missing) { throw "Missing Task 3 files: $($missing -join ', ')" }
  git diff --check
  ```

  Expected: no missing-file exception and no whitespace errors. Commit with:

  ```bash
  git add .github
  git commit -m "chore: add GitHub contribution templates"
  ```

---

### Task 4: Validate the complete foundation and apply GitHub metadata

**Files:**
- Verify: `README.md`, `LICENSE`, `.gitignore`, `.gitattributes`, `.editorconfig`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`, `CHANGELOG.md`, `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/feature_request.md`, `.github/ISSUE_TEMPLATE/config.yml`, `.github/PULL_REQUEST_TEMPLATE.md`
- Modify remotely: GitHub About description and repository topics, only after local validation and only if GitHub CLI authentication succeeds.

**Interfaces:**
- Consumes: All files created by Tasks 1–3.
- Produces: A validated local repository foundation, a clean commit, and verified GitHub-facing description/topics when remote access is available.

- [ ] **Step 1: Verify every required file and the local link targets**

  Run:

  ```powershell
  $required = @(
    'README.md', 'LICENSE', '.gitignore', '.gitattributes', '.editorconfig',
    'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'SECURITY.md', 'SUPPORT.md', 'CHANGELOG.md',
    '.github/ISSUE_TEMPLATE/bug_report.md',
    '.github/ISSUE_TEMPLATE/feature_request.md',
    '.github/ISSUE_TEMPLATE/config.yml',
    '.github/PULL_REQUEST_TEMPLATE.md'
  )
  $missing = $required | Where-Object { -not (Test-Path -LiteralPath $_) }
  if ($missing) { throw "Missing foundation files: $($missing -join ', ')" }
  git diff --check
  ```

  Expected: all files exist and Git reports no whitespace errors.

- [ ] **Step 2: Check documentation truthfulness and unfinished markers**

  Run:

  ```powershell
  $markers = @('T' + 'BD', 'TO' + 'DO', 'INSERT ' + 'CONTACT METHOD', 'fill ' + 'in', 'implement ' + 'later', 'npm ' + 'install', 'pnpm ' + 'install', 'yarn ' + 'install', 'npm ' + 'run', 'pnpm ' + 'run', 'yarn ' + 'run')
  $matches = Select-String -Path README.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, SUPPORT.md, CHANGELOG.md, .github/ISSUE_TEMPLATE/*.md, .github/ISSUE_TEMPLATE/*.yml, .github/PULL_REQUEST_TEMPLATE.md -Pattern $markers -CaseSensitive:$false
  if ($matches) { $matches | Format-Table; throw 'Unfinished content markers or premature stack-specific setup commands found.' }
  ```

  Expected: no unfinished markers and no stack-specific setup commands. The README should contain the early-stage status notice and the MCP/dashboard product positioning.

- [ ] **Step 3: Inspect GitHub CLI capability without changing remote state**

  Run:

  ```powershell
  gh --version
  gh auth status
  ```

  If `gh` is unavailable or unauthenticated, skip the remote update and report the exact values below for manual application. Do not fabricate a successful remote update.

- [ ] **Step 4: Apply and verify the approved GitHub metadata when authenticated**

  If `gh auth status` succeeds, run:

  ```powershell
  gh repo edit LaurentMaxhuni/OpenLearn --description "Open-source dashboard for turning AI-generated learning plans into visual, actionable learning experiences through MCP." --add-topic open-source --add-topic education --add-topic learning --add-topic ai --add-topic mcp --add-topic dashboard --add-topic web-components --add-topic learning-paths --add-topic personalized-learning
  gh repo view LaurentMaxhuni/OpenLearn --json name,description,repositoryTopics,url
  ```

  Expected: the returned description exactly matches the approved description, the topics include all nine approved topics, and the repository URL is `https://github.com/LaurentMaxhuni/OpenLearn`.

- [ ] **Step 5: Run the final repository checks**

  Run:

  ```powershell
  git diff --check
  git status --short --branch
  git log --oneline --decorate -5
  ```

  Expected: no whitespace errors, no untracked or unstaged foundation files, and a history containing the design commit plus the three foundation commits.

- [ ] **Step 6: Hand off the result**

  Report the created files, commit IDs, whether GitHub metadata was applied or needs manual application, and the next design boundary: web stack, component strategy, learning-plan data contract, MCP connection boundary, dashboard information architecture, and test/CI strategy.
