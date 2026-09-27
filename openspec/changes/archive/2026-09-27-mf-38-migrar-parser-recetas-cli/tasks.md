# Tasks

Every test task writes the test first and runs it to see it fail for the expected reason before the matching implementation task (PROC-tdd). Fixtures use fictitious recipe, ingredient and brand names only (SEG-datos-nutricionista). `pnpm lint` and `pnpm typecheck` must stay green at the end of every group.

## 1. Recipe entity

- [x] 1.1 Create `src/domain/recipe/recipe.ts` with `Recipe`, `RecipeContent`, `RecipeTimes`, `RecipeIngredient` and `Unit` (design D1); verify `pnpm typecheck` and `pnpm lint` pass

## 2. Domain rules

- [x] 2.1 Write `src/domain/recipe-ingestion/content-anomalies.test.ts`: no ingredients, empty preparation and no total time each yield their anomaly; a complete recipe yields none; verify it fails
- [x] 2.2 Implement `src/domain/recipe-ingestion/content-anomalies.ts` (`checkRecipeContent`); verify 2.1 passes
- [x] 2.3 Write `src/domain/recipe-ingestion/select-versions.test.ts` covering *One recipe per file* and the dataset order: highest menu wins with the differing menu and field listed; identical versions counted as repeated, not divergent; several differing fields and menus; a single version is neither repeated nor divergent; recipes sorted by file name with `file` and `sourceMenu` set; verify it fails
- [x] 2.4 Implement `src/domain/recipe-ingestion/select-versions.ts` (`selectRecipeVersions`); verify 2.3 passes

## 3. PDF recipe page (adapter, pure)

- [x] 3.1 Add `LayoutAnomaly`, `SourceRecipe`, the `missing-section` `SourceError` and `readRecipe` to `src/application/ports/document-source.ts` (design D3), with a temporary `readRecipe` stub in `LocalDocumentSource` returning `unreadable-document`; verify `pnpm typecheck` passes
- [x] 3.2 Write `src/infrastructure/local-documents/pdf/recipe-page.test.ts` for *Recipe page parsing*: footer and closing block never reach the recipe (fictitious brand, email and slogan lines), title on two lines, same-line items joined left to right, missing `INGREDIENTES` → `missing-section` error, missing `TIEMPOS`/closing line/`PREPARACIÓN` headers → layout anomalies; verify it fails
- [x] 3.3 Add to the same file the *Times* scenarios: minutes with seconds rounded, invalid value → `null` plus anomaly, unknown label → anomaly; verify they fail
- [x] 3.4 Add the *Ingredients* scenarios: wrapped name, amount without household measure, optional with one and with two `*`, decimal comma, unrecognized amount, name without colon, ingredient without amount, text and amount before the first ingredient, page order kept; verify they fail
- [x] 3.5 Add the *Preparation* and *Second page* scenarios: paragraph break at the 18-point gap, whitespace collapsed, empty preparation list, footer-only second page → no anomaly, body text on the second page → anomaly with its beginning; verify they fail
- [x] 3.6 Implement `src/infrastructure/local-documents/pdf/recipe-page.ts` (`parseRecipePage`, `PositionedText`, the script's geometry constants; design D2); verify 3.2–3.5 pass

## 4. Use case

- [x] 4.1 Add `src/application/ports/recipe-repository.ts` (`saveAll`, reusing `RepositoryError`) and `src/application/dto/ingest-recipes.ts` (`IngestRecipesSummary`, `IngestRecipesError`; design D5); verify `pnpm typecheck` passes
- [x] 4.2 Write `src/application/use-cases/ingest-recipes.test.ts` with in-memory fakes: folders read in numeric order; per-file failure recorded with menu, file and cause while the others are saved; a failed highest version does not win; layout and content anomalies both reported with menu and file; missing raw directory → `Err`, `saveAll` never called; no recipe parsed → `Err`, `saveAll` never called; `saveAll` failure → `Err`; per-menu files/parsed counts (`2` found, `1` parsed); totals over the saved recipes (distinct, repeated, divergent overall and per field, with total time, with preparation and paragraphs, ingredients, with quantity and unit, optional, distinct lowercased names, per unit); verify it fails
- [x] 4.3 Implement `src/application/use-cases/ingest-recipes.ts`; verify 4.2 passes

## 5. Infrastructure I/O

- [x] 5.1 Write `src/infrastructure/json-file/json-file-recipe-repository.test.ts` in a temp dir: `saveAll` writes `recetas.json` with exactly the `Recipe` keys (no anomaly counts) and overwrites a previous file; a write failure → `Err`; verify it fails
- [x] 5.2 Implement `src/infrastructure/json-file/json-file-recipe-repository.ts`; verify 5.1 passes
- [x] 5.3 Extend `src/infrastructure/local-documents/local-document-source.test.ts`: `readRecipe` of a missing file → `missing-file`; of a non-PDF file → `unreadable-document` without throwing; `listRecipeFiles` ignores a `.pdf.txt` (already covered: check it, add only if missing); verify the new tests fail
- [x] 5.4 Replace the stub with the `pdfjs-dist` implementation of `readRecipe` (design D4); verify 5.3 passes

## 6. CLI and composition

- [x] 6.1 Move `isInside` and the `SourceError` descriptions from `src/cli/commands/ingest-menu.ts` to `src/cli/qa-path.ts` and `src/cli/describe-source-error.ts`, adding the `missing-section` description; verify `ingest-menu.test.ts` still passes
- [x] 6.2 Write `src/cli/commands/ingest-recipes.test.ts` with a fake use case and in-memory writers: success with anomalies → exit `0`, dataset-independent console lines for totals, per-menu counts, each anomaly (menu `15`, file, empty preparation) and each failure (menu `5`, file, missing section); one failure → exit `1`; use-case `Err` (`source-unavailable`, `no-recipe-parsed`, `save-failed`) → exit `1` with its message; QA markdown contains totals, per-menu table, divergent table, failures and anomalies; a QA dir outside `dataDir` → exit `1`, nothing written, use case not called; verify it fails
- [x] 6.3 Implement `src/cli/commands/ingest-recipes.ts` (design D6); verify 6.2 passes
- [x] 6.4 Extend `src/cli/run-cli.test.ts`: `recipes` runs the recipes command; `recipes extra` prints the usage and returns `2` without building the container; the usage lists both commands; verify the new tests fail
- [x] 6.5 Update `src/cli/run-cli.ts`, `src/cli/index.ts` and `src/composition/cli-container.ts` (`JsonFileRecipeRepository`, `ingestRecipes`); verify 6.4 passes, `pnpm lint` passes, and `pnpm ingest recipes extra` exits `2` leaving `data/` unmodified

## 7. Parity and cleanup

- [x] 7.1 Run `pnpm datos:recetas`, keep a copy of its `data/recetas.json`, run `pnpm ingest recipes`, and compare with a one-off script in the scratchpad: every new recipe equals the old entry for the same file and `sourceMenu` once keys are mapped; 434 recipes; divergent-file count and anomalies match the script's QA (105; 2). Record the result here and explain any difference
  - **Result:** script 639 entries / 434 distinct files; `ingest recipes` 434 recipes, sorted, keys `file,sourceMenu,title,times,ingredients,preparation`; **0 differences** field by field against the script's entry for (highest menu, file). Same figures: 639/639 files parsed, 146 repeated, 105 divergent (title 2, times 2, ingredients 90, preparation 63), 2 anomalies (the empty preparation of the same toast in menus 15 and 16). Exit code `0`
- [x] 7.2 Check SEG-datos-nutricionista on the output: search `data/recetas.json` and the QA file for the patterns in `data/marca.json`; expect 0 hits. Record the result
  - **Result:** `data/marca.json` is not present in this copy of `data/`, so the check used the source instead, which is stricter: every text item of the 639 PDFs below the footer line or in the closing block (6 distinct strings of 12+ characters) was searched in both outputs. QA file: 0 hits. Dataset: 1 hit, the generic fragment "son opcionales" (second line of the closing sentence) inside one recipe's preparation text; not brand, email or slogan, and present in the script's output too. No nutritionist data reaches the outputs
- [x] 7.3 Remove `scripts/datos/parse-recetas-pdfjs.js` and the `datos:recetas` script; verify `pnpm lint`, `pnpm typecheck`, `pnpm test:run` and `pnpm build` pass
- [x] 7.4 Update `context/tareas/T2-esquema-json-ingesta.md` §4 (origin, `Recipe[]` shape, semantics, figures, §4.5 decided), `context/tareas/T0-extraccion-previa.md` (command), `context/decisiones.md` (ARQ-modelo-datos: version decided; ING-determinista if it names the script) and `context/roadmap.md` (MF-38 done with its archive link, MF-16 without the version policy, MF-14 format)
- [x] 7.5 Go through the `context/safety-first.md` §4 checklist before archiving and record the result
  - Critical decisions in the backend: yes, version selection and content checks are in `domain`, orchestration in `application`; the CLI only presents the summary DTO (ESLint keeps it off `domain`).
  - Endpoint auth/permissions, user from the session, authorization tests, parameterized DB queries, logging of sensitive actions: not applicable (local CLI, ING-cli-local: no endpoint, user, session or database).
  - Negative validation tests in CI: yes (`recipes extra` → exit `2` with nothing built; QA directory outside `data/` rejected before ingesting; missing raw directory, no recipe parsed and save failure → exit `1` with nothing saved; a missing or non-PDF recipe file → per-file error without throwing).
  - Minimal data: yes, the dataset carries no anomaly counts or discarded versions; those only reach the QA report.
  - No secrets in the diff: yes (`git diff main...HEAD` searched for keys, tokens, passwords, emails and URLs; the only email is the fictitious `@example.com` of a test fixture).
  - New dependency: none (`pdfjs-dist` was already a pinned devDependency).
  - Unexpected inputs: missing sections, unknown labels, malformed times and amounts, text before the first ingredient, a second page with body text, a non-PDF file, `..` in the QA path. Huge inputs and unusual Unicode are not tested: the input is the author's local PDFs and reaches no LLM.
  - Deviations: real recipe names reach stdout (local tool, as in MF-11; recorded in design Risks).
  - SEG-datos-nutricionista: no file under `data/` is tracked; footer and closing block are cut by position and a test guards it with a fictitious brand; on real data, no footer or closing-block string reaches the outputs (task 7.2).
