# Tasks

## 1. Menu score without week-wide exclusions (D3)

- [x] 1.1 Test (`score-menu.test.ts`, red): "Week-wide exclusion" (`pollo` 0.7 + exclusion `cerdo` → 0.7) and "Only week-wide exclusions" (score 1); replace the old 0.25 test
- [x] 1.2 `scoreMenu`: a week-wide exclusion gets `{ score: 1, evidence: null }` and leaves the mean; 1 when no unit is left; delete `weekWideExclusionScore`

## 2. Week-wide exclusions always filter (D2)

- [x] 2.1 Test (`hard-constraints.test.ts`, red): "A soft week-wide exclusion filters" (removed, and counted in `removedBy`), "A week-wide exclusion every menu breaks" (ranking empty, removes 36), "Slot of a week-wide exclusion"; adapt "Same threshold for an exclusion alone and in a group" to lexical 0/1 scores for the exclusion alone
- [x] 2.2 `filterByHardUnits`: a unit filters when it is `hard` or a week-wide exclusion

## 3. Lexical scores for week-wide exclusions (D1)

- [x] 3.1 Test (`find-menus.test.ts`, red): "A week-wide exclusion is lexical with the semantic strategy" (semantic score 1 for `caviar`, no lexical match → no menu removed, `removedBy` 0); with `semantic`, a lexical match of the exclusion removes the menu; the lexical port is called once per distinct excluded term; a failure of the lexical port ends the search with `search-failed` and no partial ranking
- [x] 3.2 `findMenus`: query the lexical scores of the week-wide exclusion terms with every strategy (only they are matched by text with `semantic`, and they are no longer embedded) and give them to those constraint ids in `toScoredMenu`

- [x] 3.3 Refactor, no behaviour change: `findMenus` keeps the term scores in maps keyed by term and gives `toScoredMenu` the scores of each constraint (`scoreConstraints`), instead of parallel lists matched by index

## 4. CLI prints filters (D2)

- [x] 4.1 Test (`search.test.ts`, red): "A week-wide exclusion is printed as a filter" (`Filter c2 removes 15 menus.`) and `No constraint filters the menus.` with no filtering unit; adapt the tests that expect "Hard constraint"
- [x] 4.2 `rankingLines`: print `Filter … removes …` and `No constraint filters the menus.`; check `search-text.test.ts` still passes or adapt its expected line

## 5. Golden set and measurement (D4)

- [x] 5.1 Withdraw E07 in `evals/retrieval/queries.json` (`kind: "withdrawn"`, reason: no menu is vegetarian, none is free of fish) and run `pnpm evals:golden-set`; check the report says 42 kept, exclusion 6
- [x] 5.2 Run `pnpm ingest evaluate-search` and commit the regenerated `evals/search/results.md`
- [x] 5.3 Update `context/decisiones.md` EVAL-golden-sets (43 → 42, exclusion 7 → 6) and, if the default strategy should change after the new numbers, ask the author before writing it

## 6. Check

- [x] 6.1 `pnpm typecheck` and `pnpm test:run` on the touched files; `pnpm exec eslint <touched files> --rule "import/no-cycle: off"`
- [x] 6.2 End to end: `pnpm ingest search-text "pollo, sin cerdo"` returns no menu with a dish that names pork, and prints the filter line; `pnpm ingest search-text "sin caviar"` removes no menu
- [x] 6.3 `pnpm test:coverage` before the PR; ask the author about the version in `package.json`
- [x] 6.4 Before archiving, go through `context/safety-first.md` §4 and record the result

## Security checklist (context/safety-first.md §4)

- Reviewed before archiving: the change is in the search domain, the use case and the CLI output. No new endpoint, input or dependency (only the npm script `evals:exclusion-strategies`). The excluded terms come from the request already validated by `parseSearchRequest` and reach the database through the existing `DishTextSearch` adapter, whose parameterised query does not change. No secret in the diff.
