# Design: Dependency rule between use cases, and cleanup without ports (MF-59.1)

## Context

See proposal.md, Why. Current state that shapes the approach:

- `eslint.config.mjs` declares `application` as one element per folder (`src/application/*`, capture `kind`). Every file in `use-cases/` therefore belongs to the same element instance.
- `eslint-plugin-boundaries` 7.2.0 skips imports inside one element unless `checkInternals: true` (`dist/Rules/Dependencies.js` L512-523). Without that option, a policy that leaves `use-cases` out would still let use-case → use-case imports through.
- Every use-case test (`<name>.test.ts`, next to its file) imports its own module with `@/application/use-cases/<name>`. That import is also use-cases → use-cases.
- The pre-commit hook runs ESLint (lint-staged), and `pnpm lint` is `eslint && knip`. A commit cannot leave the rule red.
- `vitest.config.mts` excludes `src/application/dto/**` from coverage. `dto/search-request.ts` already holds runtime code (`constraintSchema`).

## Goals / Non-Goals

**Goals:**
- The rule fails on exactly the 12 current imports before any code moves (RED), and passes at the end with 4 named exceptions.
- Phase 2 splits into three tracks with disjoint files, so cheap subagents can run them in parallel in one working tree.

**Non-Goals:**
- Creating any service (MF-59.2).
- Moving files into capability folders (MF-59.3).
- Changing behaviour, ports, the container's public shape (apart from removing `activeMenu`) or test assertions, beyond relocating them.

## Decisions

### D1. `checkInternals: true` on the dependency rule, not one element per file
Turn on `checkInternals` and split the policy by `kind`:

| From (`application` kind) | May import |
|---|---|
| `use-cases` | `ports`, `dto`, `services`, `domain`, `shared` |
| `services` | `ports`, `dto`, `services`, `domain`, `shared` |
| `ports` | `ports`, `dto`, `domain`, `shared` |
| `dto` | `dto`, `domain`, `shared`; never `ports` (decided by the author on 2026-10-12: a DTO is what the consumer sees, and the use case translates the port errors) |

`app`, `cli` and `infrastructure` keep their current allow-lists, which already leave `services` out.

**Alternative:** declare each use-case file as its own element (`mode: 'file'`). Rejected: it duplicates the element tree, and MF-59.3 would have to rewrite it for the subfolders. `checkInternals` also covers internal imports in the other elements. Their policies already allow their own layer (`domain` → `domain`, `infrastructure` → `infrastructure`, features → their own feature), so the expected new errors are only the 12, plus the tests covered in D2. Task 1.3 verifies this.

### D2. Tests may import use cases
The `architectureTests` block (scoped to `src/**/*.test.{ts,tsx}`) adds an extra policy: from `application` to `applicationPart('use-cases')`. This lets a test import its subject.

**Alternative:** allow only the file with the same basename. Rejected: boundaries has no "same file name" selector, and a test that imports another use case is harmless.

### D3. `import/no-cycle` through a direct dependency
- Add `eslint-plugin-import` as a devDependency, using the same major version `eslint-config-next` brings (2.32.x).
- Register `import/no-cycle` on `src/**/*.{ts,tsx}`.
- `eslint-config-next` already registers the plugin as `import` and sets the TypeScript resolver, so the rule must reuse that registration. Registering the plugin twice makes flat config fail with "Cannot redefine plugin".

Because the config never imports the package, knip reports it as unused. `knip.json` therefore lists it in `ignoreDependencies`, as it already does for `@neon/env`.

**Alternative:** rely on the transitive copy. Rejected by the author (`context/roadmap.md`, MF-59 (3)).

### D4. Temporary exceptions as a file-scoped override, named in one place
At the end of Phase 3, the 4 remaining imports are allowed by one list in `eslint.config.mjs` (`temporaryUseCaseImports`):
- It holds one caller → callee pair per import.
- Each pair becomes a config entry: the caller may import only its callee (`fileInternalPath`). For example, `select-random-menu` → `search-menus` still fails.
- A comment says: "Temporary: MF-59.2 replaces these with services."

MF-59.2 starts by deleting that block (its RED).

A second block of the same kind lets 6 DTOs (`embed-recipes`, `evaluation-report`, `ingest-menus`, `ingest-recipes`, `ingest-shopping-lists`, `migrate`) import the 10 port types they use today. MF-59.4 removes it: `QueryType`, `LayoutAnomaly` and `ShoppingListAnomaly` move to `domain/`, and each DTO gets its own failure types, which the use case translates from the port errors.

**Alternative:** `// eslint-disable-next-line` in each file. Rejected: the exceptions would be scattered, and the `eslint-comments` rules may flag them.

### D5. Where the code without ports goes
- **`EMBEDDING_VARIANT`** goes to `src/domain/search/embedding-text.ts`. It names the text that `embeddingText` builds, so it is a search rule with no library behind it.
- **`parseSearchRequest`** goes to `src/application/dto/search-request.ts`, together with its private helpers and `searchRequestSchema`. It uses zod, and `domain` forbids third-party libraries (ADR-001 §3). The schema it validates (`constraintSchema`) already lives there. Its `describe('parseSearchRequest')` block moves from `search-menus.test.ts` to a new `dto/search-request.test.ts`.
- **`positiveIntegerInput`** goes to a new `src/application/dto/positive-integer-input.ts`. It is a form-input schema shared by `select-menu` and `check-shopping-items`, and no existing DTO owns it. It gets its own test for the accepted and refused inputs, moved from the cases in `select-menu.test.ts` that exercise it.
- Coverage: once `src/application/dto/**` leaves the exclude, these files are measured at 100 % like the rest of `application/**`.

### D6. `week-menu` and `selected-week` move inside `menu-week-page`
Once `active-menu` is gone, each has exactly one caller. `weekMenu` and `selectedWeek` become non-exported `function` helpers below `menuWeekPage`, in call order (AGENTS.md: short functions, most important first). `WeekFailure` stays as an exported type of `menu-week-page.ts`, because `/menu` reads it.

`week-menu.test.ts` cases move into `menu-week-page.test.ts`, rewritten to go through `menuWeekPage`. `selected-week` had no test of its own; its branches are covered through the same entry point. If a branch cannot be reached through `menuWeekPage`, that branch is dead and gets removed rather than tested.

### D7. The container keeps its pool test
`web-container.test.ts:76-84` uses `activeMenu` to prove that lazy dependencies share one pool and report an unreachable database as `failed`. The test stays and switches to `currentSelections`, which uses the same lazy dependencies.

### D8. Metrics move to `domain/evaluation/`
`ranking-metrics.ts` and `decomposition-score.ts` move with their tests, unchanged. They measure the search, they are not its rules (decided by the author on 2026-10-12). Their only importers are `evaluate-search.ts` and `evaluate-decomposer.ts`.

### D9. Parallel execution: three tracks, disjoint files, no commits
Phase 2 tracks A (search), B (menu) and C (selection) touch disjoint file sets (listed in tasks.md). They share the working tree, not a worktree each: each worktree would need its own CodeGraph index and a merge, which costs more than the conflict risk for ~1 h of work.

Each subagent:
- runs only its scoped `pnpm vitest run <paths>` and `pnpm eslint <its files>`
- never runs `pnpm lint`, `pnpm test` or `pnpm typecheck` on the whole repo: while the tracks are in flight, the other tracks' errors would show up there
- never commits

Phase 3 integrates, runs the full checks and commits.

## Risks / Trade-offs

- **[Risk]** `checkInternals` flags internal imports beyond the 12 (for example inside `infrastructure/` or `features/`). → **Mitigation:** task 1.3 counts the errors. Anything other than the 12 plus test self-imports is fixed by adjusting the policy in Phase 1, before Phase 2 starts.
- **[Risk]** `import/no-cycle` slows ESLint on the whole tree. → **Mitigation:** keep the default `maxDepth`. If pre-commit gets noticeably slower, record the timing in Phase 3 and decide in MF-59.2.
- **[Risk]** Haiku subagents edit outside their list, or rewrite assertions while moving tests. → **Mitigation:** each task lists the allowed and forbidden files, and says "move, do not rewrite". Phase 3 checks with `git diff --stat` that each track stayed in its files, and that the total test count is unchanged, apart from the tests deleted with `active-menu`.
- **[Trade-off]** The 4 exceptions keep the rule incomplete until MF-59.2. They are listed in one block and named in the roadmap, so they can't go unnoticed.
