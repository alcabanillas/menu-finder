# Tasks: MF-59.3 Use cases in folders by capability

A file move. There is no RED in ESLint or in the tests: no behaviour changes, and the current tests are the check. The "red" is `pnpm typecheck` while the imports still point to the old paths.

## 1. Move

- [x] 1.1 Run a scratchpad script (design.md D2) that, for each of the 18 use cases in the proposal:
  - moves `<name>.ts` and `<name>.test.ts` with `git mv` to `src/application/use-cases/<folder>/`
  - replaces `@/application/use-cases/<name>'` with `@/application/use-cases/<folder>/<name>'` in every `.ts` and `.tsx` file under `src/` and `scripts/`

  Verify: `Get-ChildItem src/application/use-cases -File` returns nothing.
- [x] 1.2 `pnpm typecheck` passes, and searching for `use-cases/<name>'` with no folder finds nothing in `src/`, `scripts/` or `e2e/`.

## 2. Docs

- [x] 2.1 ADR-001 §2: in the tree, list the six folders under `use-cases/`. ADR-001 §6, "Revisar si": the 15-file threshold applies per capability folder (design.md D3).
- [x] 2.2 `AGENTS.md`: the example `use-cases/embed-recipes.ts` becomes `use-cases/ingest/embed-recipes.ts`. `context/roadmap.md`: mark MF-59.3 and MF-59 as done.

## 3. Checks

- [x] 3.1 `pnpm lint` (boundaries, `import/no-cycle`, knip) passes. Add a temporary import from `use-cases/menu/select-random-menu.ts` to `use-cases/search/search-menus`, see ESLint fail, and remove it.
- [x] 3.2 `pnpm test:coverage` passes, with the same 1321 tests.
- [x] 3.3 `pnpm test:e2e` passes (login, `/planner`, `/menu`, `/shopping-list`). Result: 88 passed.
- [x] 3.4 Commit `refactor(application): use cases in folders by capability (MF-59.3)`. No PR yet: the single MF-59 PR goes after the archive.

## Safety review (`context/seguridad/safety-first.md` §4)

- Files moved only: no endpoint, command, query, input or runtime code changes. The auth, permissions, validation, SQL and logging items do not apply.
- The server actions call the same use cases, with the same session checks; the e2e suite (88 passed) covers login, `/planner`, `/menu` and `/shopping-list`.
- No secret in the diff, and no new dependency.
- No deviation from a MUST rule.
