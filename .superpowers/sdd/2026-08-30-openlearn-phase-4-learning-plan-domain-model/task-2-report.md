# Task 2 Report: Define domain primitives, aggregate types, limits, and errors

## Initial blocked context

- Work paused before implementation because the earlier Task 2 brief said identifiers "derived from presentation text" must fail, while the approved Phase 4 specification also permits readable opaque fixture identifiers such as `fixture-item-reading`.
- The user provided a corrected ruling on 2026-08-30: readable slug-like values that satisfy the canonical identifier syntax are valid opaque identifiers, provenance is not observable, and Task 2 should cover non-derivation as a passing rule rather than reject readable IDs.
- Implementation resumed against the regenerated brief at `C:/github-projects/OpenLearn/.superpowers/sdd/2026-08-30-openlearn-phase-4-learning-plan-domain-model/task-2-brief.md`.

## What changed

- Added canonical domain limit constants in `packages/domain/src/limits.ts` using the exact Phase 4 values:
  - `ShortText` 1..240
  - `LongText` 1..4000
  - `BoundedOpaqueText` 1..512
  - `Identifier` 1..128
  - `SafeHttpsUrl` max 2048
  - `Context entries` 0..50
  - `Milestones` 1..50
  - `Topics per plan` 1..200
  - `Plan items per plan` 1..1000
  - `Resources per item` 0..20
  - `Canonical text` max 200000
- Added branded framework-neutral primitives and aggregate types in `packages/domain/src/types.ts`:
  - opaque string brands for plan/content/identity primitives
  - `Goal`, `ContextEntry`, `Context`, `Resource`, `PlanItem`, `Topic`, `Milestone`
  - `CanonicalPlanContent`
  - `PlanLifecycle`, `ProgressState`, `LearnerProgressRecord`
  - `AcceptedRevisionRef`, `PlanAggregate`
  - `PlanDeletionTombstone`
- Added error/result definitions in `packages/domain/src/errors.ts`:
  - exact `DomainErrorCategory` discriminants from the brief
  - safe machine-readable `DomainErrorDetail`
  - discriminated `DomainResult<T>` success/failure union
  - small `succeed` / `fail` helpers used by the identifier helper
- Added identity helper interfaces and identifier branding in `packages/domain/src/identity.ts`:
  - `IdentifierKind`
  - `IdentityAllocator`
  - `brandIdentifier(kind, value)`
  - exact identifier regex `^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$`
  - exact-case acceptance for valid opaque identifiers
  - rejection of empty, overlong, control-containing, and malformed-syntax identifiers
- Updated `packages/domain/src/index.ts` to export the Task 2 public API.
- Updated `packages/domain/package.json` test script so `pnpm run test` actually compiles and runs `test/**/*.ts` for this package instead of generating an empty placeholder test.
- Added `packages/domain/test/primitives.test.ts` to cover:
  - valid opaque identifier branding without case changes
  - invalid identifier rejection cases
  - readable slug-like identifier acceptance as opaque exact data
  - required aggregate fields and readonly ordered collections
  - every domain error category discriminant and safe detail shape
  - identifier kind coverage for deterministic allocators
- Added `packages/domain/test/node-shims.d.ts` so the package can compile `node:test` and `node:assert/strict` imports in the current workspace without introducing runtime coupling.

## Files changed

- `packages/domain/package.json`
- `packages/domain/src/index.ts`
- `packages/domain/src/limits.ts`
- `packages/domain/src/types.ts`
- `packages/domain/src/errors.ts`
- `packages/domain/src/identity.ts`
- `packages/domain/test/primitives.test.ts`
- `packages/domain/test/node-shims.d.ts`

## TDD evidence

### RED

Focused command:

```powershell
pnpm --filter @openlearn/domain exec tsc -p tsconfig.json
if ($LASTEXITCODE -eq 0) {
  node --test dist/test/primitives.test.js
  exit $LASTEXITCODE
}
exit $LASTEXITCODE
```

Initial RED output:

```text
../..                                    |  WARN  Unsupported engine: wanted: {"node":">=24.0.0 <25.0.0"} (current: {"node":"v22.22.1","pnpm":"10.15.0"})
test/primitives.test.ts(1,18): error TS2307: Cannot find module 'node:test' or its corresponding type declarations.
test/primitives.test.ts(2,20): error TS2307: Cannot find module 'node:assert/strict' or its corresponding type declarations.
test/primitives.test.ts(5,3): error TS2305: Module '"../src/index.js"' has no exported member 'DOMAIN_ERROR_CATEGORIES'.
test/primitives.test.ts(6,3): error TS2305: Module '"../src/index.js"' has no exported member 'DOMAIN_LIMITS'.
test/primitives.test.ts(7,8): error TS2305: Module '"../src/index.js"' has no exported member 'AcceptedRevisionRef'.
test/primitives.test.ts(8,8): error TS2305: Module '"../src/index.js"' has no exported member 'CanonicalPlanContent'.
test/primitives.test.ts(9,8): error TS2305: Module '"../src/index.js"' has no exported member 'Context'.
test/primitives.test.ts(10,8): error TS2305: Module '"../src/index.js"' has no exported member 'ContextEntry'.
test/primitives.test.ts(11,8): error TS2305: Module '"../src/index.js"' has no exported member 'DomainErrorCategory'.
test/primitives.test.ts(12,8): error TS2305: Module '"../src/index.js"' has no exported member 'DomainErrorDetail'.
test/primitives.test.ts(13,8): error TS2305: Module '"../src/index.js"' has no exported member 'DomainFailure'.
test/primitives.test.ts(14,8): error TS2305: Module '"../src/index.js"' has no exported member 'DomainResult'.
test/primitives.test.ts(15,8): error TS2305: Module '"../src/index.js"' has no exported member 'Goal'.
test/primitives.test.ts(16,8): error TS2305: Module '"../src/index.js"' has no exported member 'IdentifierKind'.
test/primitives.test.ts(17,8): error TS2305: Module '"../src/index.js"' has no exported member 'InternalOwnerId'.
test/primitives.test.ts(18,8): error TS2305: Module '"../src/index.js"' has no exported member 'LearnerProgressRecord'.
test/primitives.test.ts(19,8): error TS2305: Module '"../src/index.js"' has no exported member 'Milestone'.
test/primitives.test.ts(20,8): error TS2305: Module '"../src/index.js"' has no exported member 'PlanAggregate'.
test/primitives.test.ts(21,8): error TS2305: Module '"../src/index.js"' has no exported member 'PlanId'.
test/primitives.test.ts(22,8): error TS2305: Module '"../src/index.js"' has no exported member 'PlanItem'.
test/primitives.test.ts(23,8): error TS2305: Module '"../src/index.js"' has no exported member 'Resource'.
test/primitives.test.ts(24,8): error TS2305: Module '"../src/index.js"' has no exported member 'RevisionId'.
test/primitives.test.ts(25,8): error TS2305: Module '"../src/index.js"' has no exported member 'Topic'.
test/primitives.test.ts(26,3): error TS2305: Module '"../src/index.js"' has no exported member 'brandIdentifier'.
undefined
 ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command failed with exit code 2: tsc -p tsconfig.json
```

This was the expected RED state: the focused test referenced the missing Task 2 exports and identifier helper before implementation existed.

### GREEN

Focused command after implementation:

```powershell
pnpm --filter @openlearn/domain exec tsc -p tsconfig.json
if ($LASTEXITCODE -eq 0) {
  node --test dist/test/primitives.test.js
  exit $LASTEXITCODE
}
exit $LASTEXITCODE
```

Focused GREEN output:

```text
../..                                    |  WARN  Unsupported engine: wanted: {"node":">=24.0.0 <25.0.0"} (current: {"node":"v22.22.1","pnpm":"10.15.0"})
TAP version 13
# Subtest: brands valid opaque identifiers without changing case
ok 1 - brands valid opaque identifiers without changing case
# Subtest: rejects empty, whitespace-padded, control-containing, and overlong identifiers
ok 2 - rejects empty, whitespace-padded, control-containing, and overlong identifiers
# Subtest: accepts readable slug-like identifiers as opaque exact case-sensitive values
ok 3 - accepts readable slug-like identifiers as opaque exact case-sensitive values
# Subtest: defines required fields and preserves declared readonly collection order
ok 4 - defines required fields and preserves declared readonly collection order
# Subtest: defines every error category with safe machine-readable detail fields
ok 5 - defines every error category with safe machine-readable detail fields
# Subtest: declares identifier allocation kinds for deterministic fixture allocators
ok 6 - declares identifier allocation kinds for deterministic fixture allocators
1..6
# tests 6
# pass 6
# fail 0
```

## Exact checks run and output

### 1. Focused test

Command:

```powershell
pnpm --filter @openlearn/domain exec tsc -p tsconfig.json
if ($LASTEXITCODE -eq 0) {
  node --test dist/test/primitives.test.js
  exit $LASTEXITCODE
}
exit $LASTEXITCODE
```

Final output:

```text
../..                                    |  WARN  Unsupported engine: wanted: {"node":">=24.0.0 <25.0.0"} (current: {"node":"v22.22.1","pnpm":"10.15.0"})
TAP version 13
# Subtest: brands valid opaque identifiers without changing case
ok 1 - brands valid opaque identifiers without changing case
# Subtest: rejects empty, whitespace-padded, control-containing, and overlong identifiers
ok 2 - rejects empty, whitespace-padded, control-containing, and overlong identifiers
# Subtest: accepts readable slug-like identifiers as opaque exact case-sensitive values
ok 3 - accepts readable slug-like identifiers as opaque exact case-sensitive values
# Subtest: defines required fields and preserves declared readonly collection order
ok 4 - defines required fields and preserves declared readonly collection order
# Subtest: defines every error category with safe machine-readable detail fields
ok 5 - defines every error category with safe machine-readable detail fields
# Subtest: declares identifier allocation kinds for deterministic fixture allocators
ok 6 - declares identifier allocation kinds for deterministic fixture allocators
1..6
# tests 6
# pass 6
# fail 0
```

### 2. Full typecheck

Command:

```powershell
pnpm run typecheck
```

Output:

```text
 WARN  Unsupported engine: wanted: {"node":">=24.0.0 <25.0.0"} (current: {"node":"v22.22.1","pnpm":"10.15.0"})

> openlearn@ typecheck C:\github-projects\OpenLearn
> pnpm --recursive run typecheck

.                                        |  WARN  Unsupported engine: wanted: {"node":">=24.0.0 <25.0.0"} (current: {"node":"v22.22.1","pnpm":"10.15.0"})

> @openlearn/domain@0.0.0 typecheck C:\github-projects\OpenLearn\packages\domain
> tsc --noEmit
```

### 3. Full test run

Command:

```powershell
pnpm run test
```

Output:

```text
 WARN  Unsupported engine: wanted: {"node":">=24.0.0 <25.0.0"} (current: {"node":"v22.22.1","pnpm":"10.15.0"})

> openlearn@ test C:\github-projects\OpenLearn
> pnpm --recursive run test

.                                        |  WARN  Unsupported engine: wanted: {"node":">=24.0.0 <25.0.0"} (current: {"node":"v22.22.1","pnpm":"10.15.0"})

> @openlearn/domain@0.0.0 test C:\github-projects\OpenLearn\packages\domain
> tsc -p tsconfig.json && node --test dist/test/*.test.js

TAP version 13
# Subtest: dist\\test\\empty.test.js
ok 1 - dist\\test\\empty.test.js
# Subtest: brands valid opaque identifiers without changing case
ok 2 - brands valid opaque identifiers without changing case
# Subtest: rejects empty, whitespace-padded, control-containing, and overlong identifiers
ok 3 - rejects empty, whitespace-padded, control-containing, and overlong identifiers
# Subtest: accepts readable slug-like identifiers as opaque exact case-sensitive values
ok 4 - accepts readable slug-like identifiers as opaque exact case-sensitive values
# Subtest: defines required fields and preserves declared readonly collection order
ok 5 - defines required fields and preserves declared readonly collection order
# Subtest: defines every error category with safe machine-readable detail fields
ok 6 - defines every error category with safe machine-readable detail fields
# Subtest: declares identifier allocation kinds for deterministic fixture allocators
ok 7 - declares identifier allocation kinds for deterministic fixture allocators
1..7
# tests 7
# pass 7
# fail 0
```

## Self-review

- Confirmed the implementation stays inside `@openlearn/domain` and adds no UI, persistence, MCP, provider, or network behavior.
- Confirmed ownership remains `InternalOwnerId` only; no actor claims, provider identity, email, or subject fields appear in content types.
- Confirmed the canonical content model has exactly one `Goal`, optional plan title, optional context summary, required resource label, preserved ordered readonly collections, and no extra lifecycle/progress fields inside content.
- Confirmed active/deleted lifecycle and confirmed progress states are separated and match the approved names.
- Confirmed the exported error categories match the brief verbatim and the detail shape is machine-readable and safe.
- Confirmed the test harness change in `packages/domain/package.json` was necessary so root `pnpm run test` actually executes this package's test sources.

## Concerns

- The environment is running Node `v22.22.1` while the workspace declares `>=24.0.0 <25.0.0`. All required checks passed under Node 22, but the engine warning remains and should be resolved by running the workspace on the declared Node 24 line.
- `pnpm run test` still sees a generated `dist/test/empty.test.js` artifact left from the previous placeholder test flow. It does not affect Task 2 correctness, but it is still counted as an extra passing subtest until a later cleanup removes stale generated output handling.
