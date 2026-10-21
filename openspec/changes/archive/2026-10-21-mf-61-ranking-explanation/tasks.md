## 1. Evidence of a unit in the domain (D1, D2)

- [x] 1.1 RED: tests in `src/domain/search/constraint-unit.test.ts` for `holdsLiterally`: an ungrouped `include` (literal and not), its slot, a `sameDish` with both `include` members, a `sameDish` whose arroz dish matches the exclusion `marisco` with the semantic strategy, an `anyOf` with one member literal, and a unit with no `include` member. See them fail
- [x] 1.2 GREEN: add `literal` to `ScoredDish` and implement `holdsLiterally`
- [x] 1.3 RED: tests in `src/domain/search/score-menu.test.ts` for the scenarios of "Evidence of a unit": a literal dish wins over a more similar one, a similar dish, a similar dish below the threshold, the threshold at two decimals, the lexical strategy, the week-wide exclusion (`none`), and the menu score unchanged when the literal dish scores lower. Replace the tests of "Evidence" and "No evidence at score 0". See them fail
- [x] 1.4 GREEN: replace `bestDish` with `unitEvidence(unit, dishes, strategy)` and pass the strategy to `scoreMenu`; update its callers in `find-menus.ts`

## 2. Literal match and DTO in the search (D2, D3)

- [x] 2.1 RED: tests in `src/application/services/search/find-menus.test.ts`: with the semantic strategy the text match runs once per distinct term and the embedding service once per term; the evidence carries `match`; a failing text match with the semantic strategy gives `search-failed` and no ranking; the hybrid keeps the lexical part for `literal`. See them fail
- [x] 2.2 GREEN: fill `literal` in `toScoredDish` for the three strategies, run `lexicalScores` with the semantic strategy, and add `match` to `EvidenceDto` and `toResultDto`
- [x] 2.3 Run `pnpm typecheck` and fix every user of `EvidenceDto` the compiler names (tests of `search-menus`, `search-by-text`, `evaluate-search`, fixtures)

## 3. CLI (spec menu-search, "Search command")

- [x] 3.1 RED: test in `src/cli/commands/search.test.ts` for "Evidence printed with its kind" (`literal`, `similar`, "no dish"). See it fail
- [x] 3.2 GREEN: print the kind in `rankingLines`; check that `search-text.test.ts` still passes

## 4. View of the search (D4)

- [x] 4.1 RED: tests in `src/features/menu-planner/search-view.test.ts` for the line states (`literal` → met, `similar` → "parecido: …", week-wide exclusion → "no aparece en la semana", no dish → "ningún plato") and the screen reader text of a similar line. See them fail
- [x] 4.2 GREEN: replace `found` with `state` in `EvidenceLine` and update `toLine`
- [x] 4.3 RED: tests for `summarize`: every unit met, some met, one and two similar dishes, one unit, and a summary that holds only fixed text and counts. See them fail
- [x] 4.4 GREEN: implement `summarize` and add `summary` to `CandidateCard`
- [x] 4.5 RED: tests for `onlyExclusions`: true for "nada de cerdo", false with `garbanzos` and `cerdo`; with it, the cards have no summary. See them fail
- [x] 4.6 GREEN: add `onlyExclusions` to the ranking state

## 5. Components (D5)

- [x] 5.1 RED: tests in `menu-candidate-card.test.tsx`: "Menú N" as a heading and no badge, the summary under it, ✓ / ≈ / ✕ hidden from screen readers, no rank and no summary for only exclusions, and the accessible name of the choose button unchanged. See them fail
- [x] 5.2 GREEN: port the card changes from `MenuCandidateCard.jsx`, version `1792433417-7fa2`, and note the version in the component
- [x] 5.3 RED: tests in `planner-search.test.tsx` (or `planner-results.test.tsx`) for "Results heading": three menus, one menu, only exclusions with its line, an exclusion with another constraint, and the empty state as the heading "Ningún menú encaja con lo que has pedido". See them fail
- [x] 5.4 GREEN: implement the heading, the tie line and the empty heading in `PlannerResults`

## 6. Check

- [x] 6.1 Run `pnpm typecheck` and `pnpm test:run` on the affected files, and `pnpm exec eslint <touched files> --rule "import/no-cycle: off"`
- [x] 6.2 Run `pnpm ingest search-text "garbanzos y pescado al horno, sin cerdo"` and check that the evidence prints `literal`, `similar` or "no dish"
- [x] 6.3 In the browser, search "garbanzos y pescado al horno, sin cerdo" and "nada de cerdo" on `/planner` and compare a capture with the mock (UI-design-system step 4)
- [x] 6.5 Refactor `find-menus.ts` after review: run the independent text match and embedding calls with `Promise.all`, move `byConstraint` out of `scoreConstraints`, and build the dish records without copying the maps
- [x] 6.4 Update `context/decisiones.md` UI-planner-buscador with the three-step evidence and the summary, and mark MF-61 in `context/roadmap.md` with its result
