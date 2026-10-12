# Design: Services for the steps shared between use cases (MF-59.2)

## Context

See proposal.md, Why. Current state that shapes the approach:

- `eslint.config.mjs` already declares the `services` kind. Since MF-59.1, use cases and services may import services, and `app`, `cli` and `infrastructure` may not. Deleting `temporaryUseCaseImports` therefore leaves exactly 4 errors.
- `evaluate-search` calls `searchMenus(structure, strategy, deps)` and reads every `SearchMenusError`. `evaluate-decomposer` calls `decomposeRequest(text, { decomposer })` and reads every `DecomposeError`. Both need the whole behaviour of the function they call, with the input validation included.
- The CLI reaches `searchMenus` and `decomposeRequest` only through `cli-container.ts`. The commands receive a function, not the module.
- `selectMenu` is wired in `web-container.ts:66`, and no page calls it. Only `web-container.test.ts:44-51` and `select-random-menu` use it.
- `currentShoppingSelection` has no test of its own. The tests of its two callers cover it.

## Goals / Non-Goals

**Goals:**
- `pnpm lint` passes with no use-case exception, and a test import from one use case to another fails.
- Phase 2 splits into four tracks with disjoint files, so Haiku subagents can run them in parallel.

**Non-Goals:**
- Moving files into capability folders (MF-59.3).
- The DTO exception list (MF-59.4).
- Changing behaviour, ports or test assertions, beyond relocating them.

## Decisions

### D1. A service holds the whole step; the use case only delegates
`findMenus` and `decomposeText` hold the current body of `searchMenus` and `decomposeRequest`, with the input validation. The use cases `search-menus` and `decompose-request` delegate to them in one line and keep their signatures, so `cli-container.ts` and the CLI do not change.

**Alternative:** the use case validates and the service takes validated input. Rejected: the evaluation use cases need the same validation, so it would be written twice, or the evaluations would skip it and change behaviour.

**Alternative:** `cli-container.ts` wires the services directly and the two use cases are deleted. `composition` may import anything, so ESLint would allow it. Rejected: the roadmap decided that the use cases delegate, and the containers expose only use cases. A one-line use case is the cost of keeping that boundary.

### D2. Names follow the domain, not the use case
A service and the use case that delegates to it cannot share a name without an import alias. The services are named after what they do:
- `findMenus` and `FindMenusDeps` (was `SearchMenusDeps`), in `services/search/find-menus.ts`
- `decomposeText` and `DecomposeTextDeps` (was `DecomposeRequestDeps`), in `services/search/decompose-text.ts`, with `MAX_REQUEST_LENGTH`
- `selectMenu`, in `services/selection/select-menu.ts`. No use case keeps that name, so the name stays. Its only caller is `select-random-menu`, which is provisional (MF-43). MF-22 deletes it, and `selectMenu` goes back to `use-cases/`, called from the `/planner` server action (decided by the author on 2026-10-12, noted in `context/roadmap.md`, MF-22). Moving it inside `select-random-menu` now would mean taking it out again in MF-22.
- `currentShoppingSelection`, in `services/selection/current-shopping-selection.ts`. It returns a `Selection`, and its rule (`currentOf`) lives in `domain/selection/week.ts`, so it goes in `selection/`: the shopping list is what it is used for, not what it is (decided by the author on 2026-10-12, after the verify).

The decomposition goes in `search/` because it produces a search structure (`domain/search/request-terms.ts` already holds its rule).

### D3. Tests move with the code
- `search-menus.test.ts` → `services/search/find-menus.test.ts`
- `decompose-request.test.ts` → `services/search/decompose-text.test.ts`
- `select-menu.test.ts` → `services/selection/select-menu.test.ts`

In each test, only the import and the function name change. Each one-line use case gets one test, which checks that it returns the service's result for a fixed input. That test keeps the use case at 100 % coverage.

`currentShoppingSelection` gets a new test, written first (RED), with three cases: no current list, the current selection, and a read failure.

### D4. `selectMenu` leaves the web container
The key and its `SelectMenuInput` import go out of `web-container.ts`. The container test "refuses an invalid menu number before reaching the database" is deleted: the entry point it tested no longer exists, and the case "refuses a menu number that is not a positive integer" stays in the service's test. The container's pool test already uses `currentSelections` (MF-59.1 D7).

### D5. Parallel execution: four tracks, disjoint files, no commits
Same model as MF-59.1 D9. Track A (selection), B (shopping list), C (search) and D (decomposition) touch disjoint files, listed in tasks.md. `services/search/` is shared by C and D, but each track writes only its own two files there. Phase 3 integrates, runs the full checks and commits.

## Risks / Trade-offs

- **[Trade-off]** `search-menus` and `decompose-request` become one-line use cases. They are the entries the adapters may call (ADR-001 §3), so they stay; D1 records why.
- **[Risk]** A Haiku subagent rewrites assertions while moving a test. → **Mitigation:** "move, do not rewrite" in each task. Phase 3 checks that the test count changes only by the container test deleted (−1), the two delegation tests (+2) and the three `currentShoppingSelection` tests (+3).
- **[Risk]** `import/no-cycle` flags a service that imports the use case that calls it. → **Mitigation:** the service never imports a use case. ESLint already forbids it, so the cycle cannot appear.
