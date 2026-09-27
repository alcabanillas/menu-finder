# Proposal

## Why

`scripts/datos/parse-recetas-pdfjs.js` extracts the recipes (`data/recetas.json`, contract T2 §4) but lives outside the hexagon (ADR-001 §2: "scripts/datos/... se sustituyen por la CLI de ingesta") and has no tests. MF-11 already moved the menu leg into `pnpm ingest menu`; this change (roadmap **MF-38**) does the same for the recipe leg, as a second partial slice of MF-16 (ING-cli-local), with TDD (PROC-tdd).

The script's output is one entry per PDF (639), with Spanish keys and the same recipe repeated across menus, 105 of them in two or three different versions (T2 §4.5). ARQ-modelo-datos makes `Recipe` the unit (434 distinct files) and leaves the version choice to "la spec de ingesta"; T2 §4.5 recommends keeping the version of the highest-numbered menu. No code reads `data/recetas.json` yet (the first reader will be the T3 spike, MF-14), so, as MF-11 did for the menu, this is the cheapest moment to align the dataset with the domain model and close that open point.

## What Changes

- Add the recipe entity `Recipe` (`RecipeTimes`, `RecipeIngredient`) to `src/domain/recipe/`, mirroring ARQ-modelo-datos: one recipe per recipe file, keyed by the file name that `MenuDish.recipeFile` already holds.
- Split the script's logic by what changes with the source (ADR-001 §4): the PDF page geometry (columns, section headers, footer cut, `hh:mm:ss` times, the `1 cucharada (15 ml)` amount notation, paragraph gaps) goes to pure functions over positioned text items in `src/infrastructure/local-documents/pdf/`; what holds for any source (content checks, version selection and divergence detection) goes to pure functions in `src/domain/recipe-ingestion/`.
- Extend the `DocumentSource` port with `readRecipe`, implemented in `LocalDocumentSource` with `pdfjs-dist` (text with coordinates, as the script does).
- Add the `RecipeRepository` port (already listed in ADR-001 §4) with `saveAll(Recipe[])`, implemented for now by a JSON-file adapter that writes `data/recetas.json`; MF-16 replaces it with the database adapter.
- Add the `ingestRecipes` use case and the `pnpm ingest recipes` CLI command (thin adapter: console summary, QA report, exit code), which replaces `pnpm datos:recetas`.
- **Decision (closes T2 §4.5):** one `Recipe` per file, taken from the highest-numbered menu whose PDF could be read. The other versions are not stored; the QA report lists every file whose versions differ, with the kept menu, the discarded menus and the fields that differ.
- **BREAKING (dataset format):** `data/recetas.json` becomes the serialization of `Recipe[]` (English keys, 434 entries sorted by file name) instead of the T2 §4.2 `RecetaJson[]` (639 entries). The per-file anomaly count leaves the dataset and lives only in the QA report. T2 §4 is rewritten accordingly.
- **Behavior change:** a recipe PDF with no `INGREDIENTES` header is now reported as a per-file error (the script skipped it silently apart from an anomaly line), and it makes the command exit with a non-zero code.
- Remove `scripts/datos/parse-recetas-pdfjs.js` and `pnpm datos:recetas` once the command reaches parity: every kept recipe equal, field by field, to the script's entry for the same file and menu.

Out of scope (stays in MF-16): ingredient name normalization and the food-group table, `totalTimeMin` enrichment beyond the parsed times, season, mapping file names to database ids, the ING-trazabilidad report and DB loading. The shopping-list leg (MF-10) is untouched.

## Capabilities

### New Capabilities
- `recipe-ingestion`: parses every recipe PDF under `data/raw/Dieta/Menu <n>/` into structured recipes (title, times, ingredients, preparation), keeps one recipe per file from the highest-numbered menu, saves them, and reports errors, anomalies and divergent versions.

### Modified Capabilities
_None._ `menu-ingestion` keeps its requirements: the CLI gains a second command, but `menu` behaves as before and an unknown command is still rejected.

## Impact

- **Code:** new `src/domain/recipe/`, `src/domain/recipe-ingestion/`, `src/application/ports/recipe-repository.ts`, `src/application/use-cases/ingest-recipes.ts`, `src/application/dto/ingest-recipes.ts`, `src/infrastructure/local-documents/pdf/recipe-page.ts`, `src/infrastructure/json-file/json-file-recipe-repository.ts`, `src/cli/commands/ingest-recipes.ts`. Modified: `DocumentSource` and `LocalDocumentSource` (`readRecipe`), `run-cli.ts`, `cli/index.ts`, `cli-container.ts`. Removes `scripts/datos/parse-recetas-pdfjs.js` and the `datos:recetas` script.
- **Data:** reads the recipe PDFs in `data/raw/Dieta/` and writes `data/recetas.json` and `data/qa/qa-recetas-pdfjs.md`, all gitignored. SEG-datos-nutricionista: the nutritionist's branding, contact email and slogan sit in the page footer and in the block from "Los ingredientes con un asterisco" down; both are cut by position, as today, and a spec scenario and its test now guard it. Test fixtures use fictitious recipe names only.
- **Security (safety-first P1, SEG-owasp):** a local command run by the author (ING-cli-local), with no network, no request surface and no credentials. Abuses considered: a crafted or corrupt PDF (A08, A06 via `pdfjs-dist`) → the library error is caught and reported per file, the run goes on; a QA path escaping `data/` (A01) → rejected before writing, as in `ingest menu`; nutritionist data leaking to the repo or stdout (A02/SEG-datos-nutricionista) → footer and closing block never enter the `Recipe`, outputs stay under gitignored `data/`. `pdfjs-dist` is already a pinned devDependency covered by OSV-Scanner.
- **Decisions relied on:** ING-cli-local, ING-recetas, ING-determinista, ARQ-modelo-datos, ARQ-hexagonal (ADR-001 §3–§5), SEG-datos-nutricionista, PROC-tdd, OPS-calidad. No contradiction: this change fills the version choice ARQ-modelo-datos delegates to the ingestion spec.
- **Docs:** `context/tareas/T2-esquema-json-ingesta.md` §4, `context/tareas/T0-extraccion-previa.md` (command), `context/decisiones.md` (ARQ-modelo-datos: version decided), `context/roadmap.md` (MF-38, and MF-16 no longer lists the version policy as pending; MF-14 reads the new format).
- **Dependencies:** none new (`pdfjs-dist` and `tsx` are already devDependencies).
