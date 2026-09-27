# Tasks

Every test task writes the test first and runs it (`pnpm test`) to see it fail for the expected reason before the matching implementation task (PROC-tdd). Test fixtures use fictitious dish and file names only (SEG-datos-nutricionista). `pnpm lint` (ADR-001 boundaries) must stay green at the end of every group.

## 1. Setup

- [x] 1.1 Add `tsx` as a devDependency and an `ingest` script (`tsx src/cli/index.ts`) to `package.json`, keeping `datos:menu`; verify `pnpm install` succeeds and `pnpm exec tsx --version` prints a version
- [x] 1.2 Write `src/shared/result.test.ts` for `ok`/`err` construction and narrowing on `ok`; verify it fails because the module does not exist
- [x] 1.3 Implement `src/shared/result.ts` (`Result<T, E>`, `ok`, `err`, no extra helpers, design D8); verify 1.2 passes

## 2. Menu entity

- [x] 2.1 Create `src/domain/menu/weekly-menu.ts` with `WeeklyMenu`, `Meal`, `MenuDish`, `Day` (`monday`..`sunday`) and `MealType` (`lunch`/`dinner`) in one file, with no barrel (design D1); verify `pnpm typecheck` and `pnpm lint` pass

## 3. Text normalization and cell splitting

- [x] 3.1 Write `src/domain/menu-ingestion/text.test.ts`: accent/case stripping, non-alphanumerics to spaces, whitespace collapse, and label normalization (`MIÉRCOLES` → `miercoles`); verify it fails
- [x] 3.2 Implement `src/domain/menu-ingestion/text.ts`; verify 3.1 passes
- [x] 3.3 Write `src/domain/menu-ingestion/split-cell.test.ts` covering every *Cell splitting into dishes* scenario: two stacked marked dishes, wrapped name, Title Case wrap after a connector, unmarked dish followed by a marked one, filler dropped (fruit and each yogurt/kefir wording), empty/whitespace-only cell; verify it fails
- [x] 3.4 Implement `src/domain/menu-ingestion/split-cell.ts` (returns `ParsedDish[]` with name and mark); verify 3.3 passes
- [x] 3.5 Write `src/domain/menu-ingestion/filler.test.ts` with the filler cases moved from the split-cell tests (fruit and each yogurt/kefir wording are filler; a real dish name is not); verify it fails
- [x] 3.6 Implement `src/domain/menu-ingestion/filler.ts` (`isFiller`); verify 3.5 passes
- [x] 3.7 Move the layout code to the PDF adapter (design D2): `split-cell.ts` and its test to `src/infrastructure/menu-ingestion/pdf/` with `git mv`, dropping filler from the splitter (its test now expects filler lines as unmarked dishes); `normalizeLabel` and its tests out of `domain/menu-ingestion/text.ts` into `src/infrastructure/menu-ingestion/pdf/menu-table.ts` and `menu-table.test.ts`; verify `pnpm test`, `pnpm lint` and `pnpm typecheck` pass and `src/domain/` has no split-cell or label code
- [x] 3.8 Rename `domain/menu-ingestion/text.ts` to `comparable-name.ts` and `normalizeText` to `toComparableName` (design D2), with its test; verify `pnpm test` passes and no reference to the old names remains in `src/`

## 4. Recipe resolution

- [x] 4.1 Write the MF-11 regression test first in `src/domain/menu-ingestion/recipe-match.test.ts`: a marked dish whose best candidate scores `0.5` resolves to `unresolved` carrying that discarded candidate and score; verify it fails
- [x] 4.2 Add to the same test file the remaining *Recipe resolution for marked dishes* scenarios: resolved at score `1`, exactly `0.6` resolves, no candidate files → `unresolved` with no discarded candidate, unmarked dish → `unmarked` even with an exact file-name match, ties keep the first candidate, and a recipe matching each breakfast prefix never selected; verify they fail
- [x] 4.3 Implement `src/domain/menu-ingestion/recipe-match.ts` (containment score, breakfast exclusion, `resolveDish` with the discriminated result of design D2); verify 4.1 and 4.2 pass

## 5. Weekly menu building (domain)

- [x] 5.1 Define `SourceMenu` in `src/domain/menu-ingestion/source-menu.ts` (meals by `Day` and `MealType`, ordered dishes with name and mark; design D1); verify `pnpm typecheck` passes
- [x] 5.2 Write `src/domain/menu-ingestion/build-weekly-menu.test.ts` over a fictitious `SourceMenu`: 14 meals ordered by day and then lunch before dinner (a meal the source omits is added with `dishes: []`), `number` numeric, 1-based `position` following source order after dropping unmarked filler (a marked filler-looking dish is kept), empty Sunday meals, `recipeFile` set only for resolved dishes, no score in the `WeeklyMenu`, and per-dish resolutions and counters (empty slots, multi-dish slots, resolved/unmarked/unresolved, unclaimed recipe files) returned alongside, all counted after dropping filler (a cell with only filler counts as an empty slot; a dish plus filler is not a multi-dish slot); verify it fails
- [x] 5.3 Implement `src/domain/menu-ingestion/build-weekly-menu.ts`; verify 5.2 passes

## 6. Ports and use case

- [x] 6.1 Define `src/application/ports/document-source.ts` (`listMenuFolders`, `readMenu` returning `SourceMenu`, `listRecipeFiles`, `MenuFolder`, `SourceError` with missing file / unreadable document / no table / missing header / missing meal row) and `src/application/ports/menu-repository.ts` (`saveAll`, `RepositoryError`), plus the `IngestMenusSummary` DTO in `src/application/dto/ingest-menus.ts` (design D3/D5); verify `pnpm typecheck` and `pnpm lint` pass
- [x] 6.2 Write `src/application/use-cases/ingest-menus.test.ts` with in-memory fakes: menus saved in numeric order (`10`, `2`, `1` → `1`, `2`, `10`); each per-menu `SourceError` recorded with its cause while the other menus are still saved; a missing raw directory → `Err` and `saveAll` never called; no menu parsed (or no menu folders) → `Err` and `saveAll` never called; a `saveAll` failure → `Err`; non-menu folders are the adapter's job (7.5); the summary's QA rows, unresolved list, totals and `1/2`-style processed count; verify it fails
- [x] 6.3 Implement `src/application/use-cases/ingest-menus.ts`; verify 6.2 passes

## 7. Infrastructure adapters

- [ ] 7.1 Extend `src/infrastructure/menu-ingestion/pdf/menu-table.test.ts` with the *Menu table location* scenarios over fictitious `string[][]` tables: header and `Comida`/`Cena` rows found, accent/case differences in labels, `Lunes`..`Domingo` mapped to `monday`..`sunday`, every cell split into ordered dishes, empty Sunday cells → meals with no dishes, a missing header → `SourceError` "missing header", a missing `Cena` row → `SourceError` naming the row; verify it fails
- [ ] 7.2 Implement the table-to-`SourceMenu` function in `src/infrastructure/menu-ingestion/pdf/menu-table.ts`, pure and without I/O; verify 7.1 passes
- [ ] 7.3 Write `src/infrastructure/menu-ingestion/json-file-menu-repository.test.ts` against a temp directory: `saveAll` writes `menu-platos.json` with the exact `WeeklyMenu[]` shape (the test fixes the keys), with no score or candidate fields, and overwrites a previous file; verify it fails
- [ ] 7.4 Implement `src/infrastructure/menu-ingestion/json-file-menu-repository.ts`; verify 7.3 passes
- [ ] 7.5 Write `src/infrastructure/menu-ingestion/local-document-source.test.ts` against a temp directory with empty placeholder files: only `Menu <n>` folders listed, a missing raw directory → `Err`, recipe files are `.pdf` only (a stray `.pdf.txt` is ignored), `menu`, `Lista_de_la_compra` and `valoracion*` excluded, extension removed and deduplicated, a missing `menu.pdf` → "missing file" error, a non-PDF `menu.pdf` → "unreadable document" error without throwing; verify it fails
- [ ] 7.6 Implement `src/infrastructure/menu-ingestion/local-document-source.ts` (`node:fs/promises` plus `pdf-parse` `getTable()`, first table of the first page, then `pdf/menu-table.ts`; library exceptions mapped to `Result`); verify 7.5 passes

## 8. CLI command and composition

- [ ] 8.1 Write `src/cli/commands/ingest-menu.test.ts` with a fake use case and in-memory writers: full success → exit `0`; unresolved dishes → exit `0` with one console line per dish showing menu, `day`, `type`, dish, discarded candidate and `0.50`; no unresolved dishes → the "no unresolved marked dishes" line; one menu error → exit `1` and the error printed with its cause; use-case `Err` → exit `1`; the summary counters printed; the CSV row of an unresolved dish has an empty `match_receta` and the candidate and score in `discarded_candidate`/`discarded_score`; the CSV row of a resolved dish shows its recipe in `match_receta`; the score `2/3` printed as `0.67`; a QA path resolving outside the data directory is rejected without writing; verify it fails
- [ ] 8.2 Implement `src/cli/commands/ingest-menu.ts` (console summary and QA CSV/MD writing under `<dataDir>/qa/`, design D6); verify 8.1 passes
- [ ] 8.3 Write `src/cli/index.test.ts` for argument dispatch: an unknown command or any extra argument prints the usage and returns exit `2` without building the container (asserted with a spy factory); `menu` runs the command; verify it fails
- [ ] 8.4 Implement `src/cli/index.ts` (the only file touching `process`) and `src/composition/cli-container.ts` (repo-root-based `data/raw/Dieta` and `data/`, `LocalDocumentSource`, `JsonFileMenuRepository`); verify 8.3 passes and `pnpm lint` passes (the CLI imports no `domain` or `infrastructure`)
- [ ] 8.5 Run `pnpm ingest foo` and `pnpm ingest menu extra`; verify both print the usage, exit with code `2`, and leave `data/` unmodified (compare timestamps)

## 9. Parity and roadmap checks (local, real data)

- [ ] 9.1 Save the old output (`pnpm datos:menu`, then copy `data/menu-platos.json` to `data/qa/menu-platos.legacy.json`), run `pnpm ingest menu`, and verify the command exits with `0` and writes `data/menu-platos.json` and both QA files, and nothing outside `data/` (`git status` clean)
- [ ] 9.2 Write a one-off comparison script in the scratchpad (not committed) that maps the legacy `MenuJson[]` to `WeeklyMenu` and diffs it against the new file dish by dish; verify every difference is explained (a `.pdf.txt` without a `.pdf`, a genuinely missing recipe, or a filter error) and record the counts and explanations in this task's notes
- [ ] 9.3 Decide `MATCH_THRESHOLD` with the parity data: keep `0.6` or raise it to `1` (with the current `data/raw` every resolved dish scores `1`; the menu 1 `scoreMatch: 0.4` came from a manually renamed recipe file, not from the data); record the decision and its reason in `design.md` and the spec
- [ ] 9.4 Investigate the roadmap's menu 10 case and every other unresolved dish: check whether the recipe PDF is really missing or `BREAKFAST_RECIPE_PREFIXES` removes a non-breakfast recipe; if the filter is wrong, add a failing test in `recipe-match.test.ts` with a fictitious name, fix the prefixes, and verify the test passes and the dish resolves on a rerun
- [ ] 9.5 Cross-check the recipes `pnpm datos:recetas` extracts against the `recipeFile` values `ingest menu` resolves; verify that every resolved recipe exists in the recipes output, or record each exception with its cause

## 10. Cleanup and documentation

- [ ] 10.1 Remove `scripts/datos/parse-menu-pdftable.js` and the `datos:menu` script from `package.json`; verify `pnpm lint`, `pnpm typecheck` and `pnpm test` pass and the other `scripts/datos/` scripts still exist
- [ ] 10.2 Rewrite `context/tareas/T2-esquema-json-ingesta.md` §2 for the `WeeklyMenu[]` format: the new §2.1 origin (`pnpm ingest menu`, `src/`), §2.2 shape, §2.3 semantics (score only in the QA report), and §2.5 numbers from 9.1–9.3; verify no reference to `parse-menu-pdftable.js`, `recetaFichero` or `scoreMatch` remains in §2
- [ ] 10.3 Update `context/tareas/T0-extraccion-previa.md` (step 2: command and output), `context/decisiones.md` (ING-menu-json, ING-parser-menu, ING-trazabilidad: script name → CLI command), `context/datos.md` (coverage numbers, if 9.2 changed them) and `context/roadmap.md` (MF-11 status, MF-14 reads the `WeeklyMenu[]` format); verify `grep -rn "parse-menu-pdftable\|datos:menu" context/` returns only `historial-de-decisiones.md` (frozen)
