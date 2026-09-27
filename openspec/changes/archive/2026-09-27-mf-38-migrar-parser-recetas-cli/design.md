# Design

## Context

See proposal.md — Why. Requirements are in `specs/recipe-ingestion/spec.md`.

Current state that shapes the approach:

- MF-11 set the conventions this change copies: `Result` in `shared/`, `DocumentSource` and `MenuRepository` ports, `LocalDocumentSource` in `infrastructure/local-documents/` with pure layout functions in `pdf/`, `JsonFileMenuRepository` in `infrastructure/json-file/`, the `ingestMenus` use case returning a summary DTO, and `runCli` dispatching to `runIngestMenu`, which prints and writes the QA files.
- ESLint (ADR-001 §3): `domain` imports no library; `cli` reaches only `composition/cli-container`, `application` use cases/DTOs and `shared`, so everything the command prints arrives as a DTO.
- ADR-001 §4 already lists `RecipeRepository`; no other port is needed.
- The script reads text with coordinates through `pdfjs-dist` (`legacy/build/pdf.mjs`, which ships `pdf.d.mts`). `pdf-parse` wraps the same library but does not expose item positions. `pdfjs-dist` is already a pinned devDependency.
- The page geometry and the anomaly rules are documented in T2 §4.1–§4.4. The current run on `data/raw` yields 639 recipes, 434 distinct files, 105 of them with divergent versions, 2 anomalies (empty preparation) and 0 skipped files.
- No code reads `data/recetas.json` yet; MF-14 will be its first reader.

## Goals / Non-Goals

**Goals:**
- A domain entity `Recipe` that is already the unit ARQ-modelo-datos persists, keyed by file name.
- The page geometry in pure adapter functions tested with fictitious positioned text items, and the source-independent rules (content checks, version selection) in pure domain functions.
- Content parity with the script for every kept recipe.
- A thin `recipes` CLI command next to `menu`.

**Non-Goals:**
- Ingredient normalization, food groups, season, DB ids, ING-trazabilidad report, DB loading (MF-16).
- Read methods on `RecipeRepository`.
- Generating synthetic PDFs as fixtures: the `pdfjs-dist` call is covered by the parity run, as `pdf-parse` was in MF-11.
- A shared ingestion summary type for menus and recipes: the two reports have different contents.

## Decisions

### D1 — Where the types live

| Types | Location | Why |
|---|---|---|
| `Recipe`, `RecipeContent`, `RecipeTimes`, `RecipeIngredient`, `Unit` | `src/domain/recipe/recipe.ts` | The entity, used by search, the web and MF-16's repository. |
| `RecipeVersion`, `VersionSelection`, `DivergentRecipe`, `RecipeField`, `ContentAnomaly` | `src/domain/recipe-ingestion/` | Ingestion intermediates. |
| `PositionedText`, `LayoutAnomaly` | `LayoutAnomaly` next to the port (`application/ports/document-source.ts`), `PositionedText` in `infrastructure/local-documents/pdf/recipe-page.ts` | The anomaly travels through the port; the positioned item is PDF-only. |
| `IngestRecipesSummary`, `IngestRecipesError` | `src/application/dto/ingest-recipes.ts` | Use-case output, the only thing the CLI sees. |

```ts
type Unit = "g" | "ml" | "kg" | "l";
type RecipeTimes = { total: number | null; preparation: number | null; cooking: number | null; resting: number | null };
type RecipeIngredient = { name: string; householdMeasure: string | null; quantity: number | null; unit: Unit | null; optional: boolean };
type RecipeContent = { title: string; times: RecipeTimes; ingredients: RecipeIngredient[]; preparation: string[] };
type Recipe = { file: string; sourceMenu: number } & RecipeContent;
```

`quantity` and `unit` are nullable because an unrecognized amount keeps its text (spec *Ingredients*); with the current data none is null. `file` is the natural key until MF-16 gives recipes a DB id, and it is what `MenuDish.recipeFile` holds. `sourceMenu` records which version was kept: it is provenance, not match evidence, and MF-16 needs it to explain the choice. Anomaly counts stay out of the entity (the MF-11 criterion: QA evidence lives in the DTO).

*Alternative:* keep the script's Spanish `RecetaJson`. Rejected for the same reason as in MF-11: MF-16 and MF-14 would have to translate it.

### D2 — Split by what changes with the source

**PDF adapter — `src/infrastructure/local-documents/pdf/recipe-page.ts`**, pure, no I/O:
- `parseRecipePage(page1: PositionedText[], page2: PositionedText[] | null): Result<{ content: RecipeContent; anomalies: LayoutAnomaly[] }, SourceError>`.
- Footer cut, title, columns, section headers, closing line, `hh:mm:ss` → minutes, time labels, the `- Name:` convention, the `(<n> <unit>) *` amount notation and paragraph gaps. All of them would change with another layout (a spreadsheet would bring quantity and unit in their own columns), so they are the adapter's.
- The geometry constants (`FOOTER_MAX_Y = 40`, `TITLE_MIN_Y = 700`, `COL_RIGHT_X = 290`, `COL_VALUE_X = 150`, `SAME_LINE_TOL = 2`, `PARAGRAPH_GAP = 18`) keep the script's values and names.

**Domain — `src/domain/recipe-ingestion/`**:
- `content-anomalies.ts`: `checkRecipeContent(content): ContentAnomaly[]` — no ingredients, empty preparation, no total time. They hold for any source.
- `select-versions.ts`: `selectRecipeVersions(versions: RecipeVersion[]): VersionSelection` — groups by file, keeps the highest menu, compares the others field by field (`title`, `times`, `ingredients`, `preparation`, by structural equality), returns the recipes sorted by file name (plain code-unit comparison, deterministic across locales), the repeated-file count and the divergent files.

Anomaly kinds, split by owner:
- `LayoutAnomaly` (adapter): `missing-times-section`, `missing-closing-line`, `missing-preparation-section`, `unknown-time-label`, `invalid-time`, `text-before-first-ingredient`, `amount-without-ingredient`, `name-without-colon`, `ingredient-without-amount`, `unrecognized-amount`, `unexpected-second-page-text`. Each carries the offending text, when there is one.
- `ContentAnomaly` (domain): `no-ingredients`, `empty-preparation`, `missing-total-time`.

The script reported "sin Total" and "0 ingredientes" from the layout code; they move to the domain, so each is reported once. A missing preparation header yields both `missing-preparation-section` and `empty-preparation`, as the script did.

*Alternative:* put everything in the adapter. Rejected: version selection is the core decision of this change and must be testable without anything PDF-shaped, and ADR-001 §4 fixes the criterion.

### D3 — Ports

`DocumentSource` gains:
- `readRecipe(folder: MenuFolder, file: string): Promise<Result<SourceRecipe, SourceError>>`, with `SourceRecipe = { content: RecipeContent; anomalies: LayoutAnomaly[] }`.
- `SourceError` gains `{ kind: "missing-section"; section: "ingredients" }`. `missing-file` and `unreadable-document` are reused.

`listRecipeFiles` is reused as it is (`.pdf` only, non-recipe files excluded). Breakfast recipes are recipes; their exclusion lives in the menu matcher, not here.

`src/application/ports/recipe-repository.ts`: `saveAll(recipes: Recipe[]): Promise<Result<void, RepositoryError>>`. `RepositoryError` is imported from `menu-repository.ts` rather than duplicated.

### D4 — Infrastructure

- `LocalDocumentSource.readRecipe`: `readFile`, then `getDocument({ data, verbosity: 0 })` from `pdfjs-dist/legacy/build/pdf.mjs` (dynamic `import()` so the module loads only when recipes are read), `getTextContent()` of page 1 and, if present, page 2, mapped to `PositionedText { x: transform[4], y: transform[5], text }` with empty strings dropped, then `parseRecipePage`. Library exceptions become `unreadable-document`; `doc.destroy()` runs in `finally`.
- `src/infrastructure/json-file/json-file-recipe-repository.ts` (`JsonFileRecipeRepository`): writes `JSON.stringify(recipes, null, 2)` to `<dataDir>/recetas.json`. An adapter test fixes the keys.

### D5 — Use case: `src/application/use-cases/ingest-recipes.ts`

`ingestRecipes({ source, recipes })` → `Result<IngestRecipesSummary, IngestRecipesError>`:
1. `listMenuFolders` (missing raw directory → `Err`, nothing saved).
2. For each folder in numeric order and each recipe file in name order: `readRecipe`; record a per-file failure, or a `RecipeVersion` plus its layout anomalies and `checkRecipeContent` anomalies.
3. No version → `Err({ kind: "no-recipe-parsed", failures })`, nothing saved.
4. `selectRecipeVersions`, `recipes.saveAll`, and the summary: `perMenu` (`{ menu, files, parsed }`), `failures` (`{ menu, file, error }`), `anomalies` (`{ menu, file, anomaly }`, layout and content in one tagged union), `divergent` and `totals` computed over the saved recipes (spec *Recipe ingestion report*).

`IngestRecipesError`: `source-unavailable`, `no-recipe-parsed`, `save-failed`, as in `ingestMenus`.

### D6 — CLI

- `CliCommands` becomes `{ menu; recipes }`; `runCli` accepts exactly one of the two names and prints a usage listing both otherwise (exit `2`, container not built).
- `src/cli/commands/ingest-recipes.ts` (`runIngestRecipes`), same shape as `runIngestMenu`: rejects a QA directory outside `dataDir` before running, prints the totals, the per-menu table, each failure and each anomaly, writes `<qaDir>/qa-recetas-pdfjs.md` (the script's file name, kept for local habits) with the totals, per-menu table, divergent-versions table, failures and anomalies. Exit `1` on `Err` or on any failure, `0` otherwise.
- The path-confinement helper (`isInside`) is currently private to `ingest-menu.ts`; it moves to `src/cli/qa-path.ts` and both commands use it. The source-error descriptions move alongside it for the same reason.
- `cli-container.ts` adds `JsonFileRecipeRepository` and `ingestRecipes`.

### D7 — Test strategy (PROC-tdd)

- **Adapter layout (`recipe-page.test.ts`):** fictitious `PositionedText[]` built by a small helper (`at(x, y, text)`); one test per scenario of *Recipe page parsing*, *Times*, *Ingredients*, *Preparation* and *Second page*, including the SEG-datos-nutricionista scenario with a fictitious brand line in the footer and in the closing block.
- **Domain:** `checkRecipeContent` and `selectRecipeVersions` with fictitious recipes (highest menu wins, identical versions not divergent, divergent fields listed, sorting).
- **Use case:** in-memory fakes; ordering, per-file failures, failed version does not win, no recipe → `Err` without save, save failure, totals and per-menu counts.
- **Infrastructure I/O:** `JsonFileRecipeRepository` in a temp dir; `LocalDocumentSource.readRecipe` with a missing file and a non-PDF file (errors, no throw). Real PDFs only in the parity run.
- **CLI:** `runIngestRecipes` with a fake use case; `runCli` dispatch of `recipes` and rejection of `recipes extra`.

## Risks / Trade-offs

- [`pdfjs-dist` call untested by unit tests] → Thin wrapper; the parity run exercises it on the 639 PDFs.
- [Version choice drops content] → The dropped versions are listed in the QA report with their differing fields; they remain in `data/raw`. EVAL-ground-truth (MF-15) samples PDFs, not the dataset, so it is unaffected.
- [Content statistics change meaning (over 434 kept recipes instead of 639 PDFs)] → Intentional; the parity check compares per recipe, and T2 §4.4 is rewritten with the new figures.
- [Real recipe names reach stdout] → Local tool, as today; outputs under gitignored `data/`.

## Migration Plan

1. Implement D1–D6 test-first; keep `datos:recetas` meanwhile.
2. **Parity:** run `pnpm datos:recetas` and keep its JSON; run `pnpm ingest recipes`; with a one-off local script (not committed), map each old entry for (highest menu, file) to the new keys and compare every kept recipe field by field; compare the divergent-file count (105) and anomalies (2). Record the result in tasks.
3. Remove `scripts/datos/parse-recetas-pdfjs.js` and `datos:recetas`.
4. Update T2 §4, T0, decisiones (ARQ-modelo-datos), roadmap (MF-38, MF-16, MF-14).

Rollback: before step 3, `pnpm datos:recetas` still works (it writes the old format to the same file); after, revert the removal commit.
