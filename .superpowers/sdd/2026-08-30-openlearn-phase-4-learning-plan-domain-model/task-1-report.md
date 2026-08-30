# Task 1 Report: Establish the workspace and domain-package test harness

## Implementation summary

Established the private `openlearn` pnpm workspace on `phase-4-learning-plan-domain-model` with `apps/*` and `packages/*` workspace globs. Added the required pnpm and Node engine declarations, strict NodeNext TypeScript configuration, recursive root scripts, and the `@openlearn/domain` ESM package.

The domain package currently exposes only `export {};` from `src/index.ts`. No domain behavior, runtime framework, database, MCP, provider, or UI dependency was added. TypeScript `5.9.3` is a development dependency, installed from the declared `^5.9.2` range. The package test script builds first, creates an empty compiled test target for the intentionally empty harness, and runs Node's test runner over `dist/test/*.test.js`.

## Tests and exact output

Install command:

```text
pnpm install
 WARN  Unsupported engine: wanted: {"node":">=24.0.0 <25.0.0"} (current: {"node":"v22.22.1","pnpm":"10.15.0"})
Scope: all 2 workspace projects
Progress: resolved 1, reused 0, downloaded 0, added 0
Packages: +1
+
Progress: resolved 1, reused 1, downloaded 0, added 1, done

devDependencies:
+ typescript 5.9.3 (7.0.2 is available)

Done in 1.1s using pnpm v10.15.0
```

Commands run:

```text
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run verify
```

Exact final result lines:

```text
> @openlearn/domain@0.0.0 typecheck C:\github-projects\OpenLearn\packages\domain
> tsc --noEmit

> @openlearn/domain@0.0.0 test C:\github-projects\OpenLearn\packages\domain
> pnpm run build && node -e "const fs = require('node:fs'); fs.mkdirSync('dist/test', { recursive: true }); fs.writeFileSync('dist/test/empty.test.js', '')" && node --test dist/test/*.test.js

TAP version 13
# Subtest: dist\\test\\empty.test.js
ok 1 - dist\\test\\empty.test.js
1..1
# tests 1
# pass 1
# fail 0

> @openlearn/domain@0.0.0 build C:\github-projects\OpenLearn\packages\domain
> tsc -p tsconfig.build.json
```

`pnpm run typecheck`, `pnpm run test`, `pnpm run build`, and `pnpm run verify` all exited successfully. Each command emitted the same expected engine warning because the host runtime is Node `v22.22.1`, below the required Node 24 range. `git diff --check` also exited successfully.

## TDD evidence

TDD was not applicable to this task: the brief is configuration and package scaffolding only, explicitly assigns no test source file, and requires the public entry point to remain empty. The required test command was used as harness verification. An initial run correctly exposed that an empty `dist/test` directory is not accepted as a Node 22 Windows test target; the script was minimally adjusted to generate an empty test file and use the supported `dist/test/*.test.js` glob. The corrected test then passed.

## Files changed

Created for this task:

- `package.json`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml` (created by the successful pinned pnpm install)
- `tsconfig.json`
- `packages/domain/package.json`
- `packages/domain/tsconfig.json`
- `packages/domain/tsconfig.build.json`
- `packages/domain/src/index.ts`
- `.superpowers/sdd/2026-08-30-openlearn-phase-4-learning-plan-domain-model/task-1-report.md`

Preserved unrelated pre-existing change:

- `docs/superpowers/plans/2026-08-30-openlearn-phase-4-learning-plan-domain-model.md` remains untracked and was not staged.

## Self-review findings

- Confirmed the current branch is `phase-4-learning-plan-domain-model`.
- Confirmed the checkout is the primary `C:/github-projects/OpenLearn` worktree; no linked worktree was created or used.
- Confirmed the package entry point contains only `export {};`.
- Confirmed the workspace contains only `apps/*` and `packages/*` globs.
- Confirmed all requested strict TypeScript compiler options are present.
- Confirmed generated `dist/` and dependency directories remain ignored.
- Confirmed no runtime dependencies or framework/provider/database/MCP/UI integrations were added.
- Confirmed no unrelated tracked or untracked file was staged.

## Concerns

The environment has Node `22.22.1`, while the task requires Node `>=24.0.0 <25.0.0`; pnpm therefore reports an engine warning. The pinned pnpm `10.15.0` installation and all checks still succeeded on this host. Validation under Node 24 remains recommended when that runtime is available.
