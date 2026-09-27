# Design

## Context

See proposal.md — Why. Requirements are in `specs/menu-ingestion/spec.md`.

Current state that shapes the approach:

- `src/` has the ADR-001 layer folders but no code yet: no `shared/result.ts`, no ports, no use cases, no `cli/index.ts`, no containers. This change creates the first backend slice, so its conventions become the reference for the rest.
- ESLint (`eslint-plugin-boundaries`) enforces ADR-001 §3. `domain` cannot import any library; `cli` can only reach `composition/cli-container`, `application` use cases/dto and `shared` — **not `domain`**, so everything the CLI prints must arrive as a DTO.
- ADR-001 §4 already lists `MenuRepository` and `DocumentSource` as ports; this change needs no other port. Its example put document parsing in the domain; this change amends it (D2): parsing that depends on the source document's layout belongs to that source's adapter.
- ARQ-modelo-datos fixes the persistent shape: `Menu(number, season)` → `Meal(menuId, day, type)` → `MenuDish(mealId, recipeId, position)`.
- Vitest runs `src/**/*.test.ts` in Node, with `@/` path aliases resolved through tsconfig.
- Node is v24. The repo has no TypeScript runner for scripts (`tsx`, `ts-node`); `jiti` only appears as a transitive dependency.
- `pdf-parse` (with `getTable()`) is already a devDependency. The CLI only runs on the author's machine, so it stays a devDependency.
- No code reads `data/menu-platos.json` today; the T3 spike (MF-14) will be its first reader.
- The roadmap entry for MF-11 adds checks beyond the original proposal: the breakfast-prefix filter, the dish-by-dish warning, a cross-check against `datos:recetas`, and `.pdf`-only candidates. The spec encodes the `.pdf`-only rule and the warning.

## Goals / Non-Goals

**Goals:**
- A domain entity `WeeklyMenu` that is already the shape MF-16 will persist, so the ingestion's output does not need a second translation later.
- A domain that does not know the source document: it receives source-agnostic menus (meals with dish names and marks) and owns only what holds for any source (filler rule, recipe resolution, `WeeklyMenu` building). A menu arriving from, say, a spreadsheet with one dish per row would need a new adapter, not domain changes.
- Pure, string-in/data-out functions for everything the script decides, on both sides of the port, so the MF-11 bug is reproduced and fixed by unit tests with no PDF or filesystem.
- Two ports already named in ADR-001 §4: `DocumentSource` (read) and `MenuRepository` (save), with a temporary JSON-file adapter for the latter.
- A thin CLI command whose only logic is argument parsing, presenting the use case's summary (console and QA files) and exit-code mapping.
- Content parity with the current script on the real dataset, except for the documented intentional differences.

**Non-Goals:**
- A general `ingest` pipeline with subcommands for the shopping list or recipes (MF-16). The entry point allows adding them later, but only `menu` exists.
- Idempotent loading into the DB, mapping `recipeFile` to `Recipe.id`, season, brand scrubbing, trace reports (ING-trazabilidad) — MF-16.
- Read methods on `MenuRepository` (`find`, `search`): added by the slice that needs them.
- A separate serialization type for the JSON file: the file is temporary (see D4).
- Unit-testing `pdf-parse` itself or generating synthetic menu PDFs as fixtures.

## Decisions

### D1 — Where the types live

| Types | Location | Why |
|---|---|---|
| `WeeklyMenu`, `Meal`, `MenuDish`, `Day`, `MealType` | `src/domain/menu/weekly-menu.ts` | The menu entity, not an ingestion detail: search, the web (through use cases) and MF-16's repository use it. |
| `SourceMenu` (meals by day and type, ordered dishes with name and mark) | `src/domain/menu-ingestion/source-menu.ts` | What any menu source yields. It lives in the domain, not next to the port, because the domain function that builds `WeeklyMenu` consumes it and `domain` cannot import `application`. |
| `DishResolution` | `src/domain/menu-ingestion/` | Ingestion intermediate; nobody outside ingestion needs it. |
| `ParsedDish` | `src/infrastructure/menu-ingestion/pdf/` | Output of the PDF cell splitter; the adapter maps it into `SourceMenu`. |
| `IngestMenusSummary` (errors, totals, per-dish QA rows, unresolved dishes) | `src/application/dto/ingest-menus.ts` | Use-case output; the CLI can only import DTOs. |
| `MenuFolder`, `SourceError` (incl. missing header / missing meal row) | next to their port in `src/application/ports/` | Only meaningful as part of the port contract. |

```ts
type WeeklyMenu = { number: number; meals: Meal[] };      // always 14 meals
type Meal = { day: Day; type: MealType; dishes: MenuDish[] };
type MenuDish = { position: number; name: string; hasRecipeMark: boolean; recipeFile: string | null };
```

The aggregate stays in one file while it is only types (~15 lines). An entity moves to its own file in `domain/menu/` (e.g. `meal.ts`) when it gains functions or invariants. There is no `index.ts` barrel: imports point to the defining file. Types are never placed in a cross-layer `src/types/`: entities belong to `domain`, contracts to `application`, and only technical utilities to `shared` (ADR-001 §2–§3).

`hasRecipeMark` stays in the entity: it is the PDF's literal `*`, source data rather than match evidence, and it is what tells "no recipe expected" apart from "recipe expected but missing". `recipeFile` is a file name until leg 3 maps it to `Recipe.id` (T2 §2.6). Scores and discarded candidates are match evidence and exist only in the DTO.

*Alternative:* keep the script's `MenuJson` (Spanish keys, per-dish score) as the domain type. Rejected: it mixes QA evidence into the entity and would force a translation to ARQ-modelo-datos in MF-16, once the T3 spike already depends on it.

### D2 — Split by what changes with the source: domain vs. PDF adapter

**Criterion:** a rule that would change if the menus arrived with a different layout (another table shape, a spreadsheet with one dish per row, repeated meal rows) belongs to the source adapter; a rule that holds for any source belongs to the domain. This amends the example in ADR-001 §4.

**Domain — `src/domain/menu-ingestion/`**, pure functions:
- `source-menu.ts`: the `SourceMenu` type.
- `comparable-name.ts`: `toComparableName`, the lowercase, accent-free form in which dish and recipe names are compared. Named for its purpose, not its data type, so it does not turn into a generic `text`/`utils` module.
- `filler.ts`: the generic fillers (a piece of fruit, a sugar-free yogurt/kefir) that are not dishes when unmarked. They are the nutritionist's wording, not the PDF's layout.
- `recipe-match.ts`: containment score, the breakfast-recipe exclusion and `resolveDish`, which returns `{ status: 'resolved', recipe, score } | { status: 'unresolved', discarded: { recipe, score } | null } | { status: 'unmarked' }`.
- `build-weekly-menu.ts`: from one `SourceMenu` and the recipe file names, builds the `WeeklyMenu` (14 meals, positions, filler dropped) plus that menu's per-dish resolutions and counters.

**PDF adapter — `src/infrastructure/menu-ingestion/pdf/`**, pure functions over strings, with no I/O:
- `split-cell.ts`: the cell splitter and its connector words → `ParsedDish[]` (every dish text, filler included).
- `menu-table.ts`: `normalizeLabel`, locating the header and the `Comida`/`Cena` rows in a `string[][]`, mapping `Lunes`..`Domingo` to `Day` and splitting each cell → `Result<SourceMenu, SourceError>`.

**Why the discriminated resolution:** this is the bug fix. The script collapses "best candidate" and "resolved recipe" into one `match` variable that the CSV prints regardless of the threshold. With a discriminated result, a formatter cannot print a discarded candidate as a match without saying so.

*Alternatives:*
- **Everything in the domain (ADR-001 §4's original example).** ESLint guarantees its purity, but the domain would hold the PDF's layout, and a new source layout would change the core while `WeeklyMenu` stays the same. Rejected.
- **Port the script as one module and patch the CSV line.** Rejected: it keeps the logic untestable without PDFs, and the regression test would have nothing to call.

**Trade-off:** in `infrastructure` ESLint allows any library import, so the purity of `split-cell.ts` and `menu-table.ts` is a convention. They are still tested with plain strings and arrays, and they sit in `pdf/`, apart from the I/O adapter.

Constants (threshold, filler patterns, connector words, breakfast prefixes) are generic food words and grammar, not nutritionist branding (SEG-datos-nutricionista).

### D3 — Ports

`src/application/ports/document-source.ts`:
- `listMenuFolders(): Promise<Result<MenuFolder[], SourceError>>`: folders named `Menu <n>`, with `n`. It fails when the raw directory is missing.
- `readMenu(folder): Promise<Result<SourceMenu, SourceError>>`: the menu as the source reads it. Errors: missing file, unreadable document, no table, missing header, missing meal row.
- `listRecipeFiles(folder): Promise<string[]>`: base names of the folder's recipe documents, extension removed and deduplicated. Which files are not recipes (`menu`, `Lista_de_la_compra`, `valoracion*`) is a fact about the source folder, so the adapter excludes them.

`src/application/ports/menu-repository.ts`:
- `saveAll(menus: WeeklyMenu[]): Promise<Result<void, RepositoryError>>`. That is the only method for now.

The QA report has **no port**: it is a presentation of the use case's summary, written by the CLI (D6), in the same way that a web page renders a DTO. This keeps ADR-001 §4 unchanged.

*Alternative:* an `IngestionOutput` write port for both the dataset and the QA files. Rejected: it adds a port that is not in ADR-001 §4 and mixes the persistent data with a report.

### D4 — Infrastructure: `src/infrastructure/menu-ingestion/`

- `local-document-source.ts`: `node:fs/promises` plus `pdf-parse` `getTable()` (the first table of the first page of `menu.pdf`), then `pdf/menu-table.ts` to produce the `SourceMenu`. Recipe files are `.pdf` only. It catches library exceptions and returns `Result` (ADR-001 §5). The raw directory is injected.
- `pdf/`: the pure layout functions of D2.
- `json-file-menu-repository.ts` (`JsonFileMenuRepository`): `saveAll` writes `JSON.stringify(menus, null, 2)` to `<dataDir>/menu-platos.json`. The file **is** the entity serialized as it is, with no separate file type and no mapping function, because the file is temporary: MF-16 replaces this adapter with a database one (e.g. `NeonMenuRepository`) by changing one line in `cli-container.ts`. An adapter test fixes the JSON shape, so that renaming an entity field fails a test instead of silently changing the file.

**Semantic difference to keep in mind for MF-16:** this adapter rewrites the whole file, so a menu that fails in this run disappears from the dataset. ING-cli-local asks the DB load to be idempotent per menu number (an upsert per menu), which would keep that menu's previous version. `saveAll`'s contract only promises "the given menus are stored"; the DB adapter must not delete menus it did not receive.

### D5 — Use case: `src/application/use-cases/ingest-menus.ts`

`ingestMenus({ source, menus })` returns `Result<IngestMenusSummary, IngestMenusError>`:
1. List the folders (a missing raw directory yields an `Err`, and nothing is saved).
2. For each menu in numeric order: `source.readMenu`, then the domain `buildWeeklyMenu` with the recipe files. Record per-menu errors and continue.
3. If no menu parsed, return an `Err` without saving. Otherwise call `menus.saveAll`, and return the summary: per-menu errors, totals, one QA row per dish (menu, day, meal, dish, mark, matched recipe or discarded candidate, score) and the unresolved-dish list.

### D6 — CLI: `src/cli/index.ts` + `src/cli/commands/ingest-menu.ts`

- `pnpm ingest menu` runs `tsx src/cli/index.ts menu`. `index.ts` dispatches on the first argument; any other argument, or any extra one, prints the usage and exits with code `2` before the container is built, so nothing is read or written.
- The command calls the use case through `composition/cli-container.ts` and presents the summary:
  - **Console:** the counters, plus one line per menu error and per unresolved marked dish, or "no unresolved marked dishes".
  - **QA files** under `<dataDir>/qa/`: `menu-platos-pdftable.csv`, with the current columns plus `discarded_candidate` and `discarded_score` (`match_receta`/`score_match` filled only for resolved dishes), and `qa-menu-platos-pdftable.md`. The file names are kept so local habits and doc links still work.
- Exit codes: `0` on full success, including when there are unresolved dishes; `1` on any menu error or on a use-case `Err`.
- The command receives its dependencies (use case, output writers, QA directory) as parameters, so its exit codes, console lines and CSV content are unit-tested with fakes. Before writing, the QA writer checks that every resolved path stays inside the data directory. `index.ts` is the only file that touches `process`.
- `cli-container.ts` resolves `data/raw/Dieta` and `data/` from the repository root, based on the entry file location rather than `process.cwd()`.

### D7 — Running TypeScript: `tsx` as a new devDependency

*Alternatives:*
- **Node 24's native type stripping.** No dependency, but it requires explicit `.ts` extensions and relative imports: no `@/` alias. It also needs `allowImportingTsExtensions` and erasable-only syntax across every module the CLI reaches, which is most of the backend the web also imports. One local tool would impose a project-wide import convention.
- **`jiti`.** It is only a transitive dependency, so it could disappear on any update.
- **Compile with `tsc` to `dist/`.** It adds a build step and an output folder for a command the author runs by hand.

`tsx` needs no changes to `tsconfig` and resolves the `@/` paths.

### D8 — Shared `Result`

Create `src/shared/result.ts` (`ok`/`err` constructors, `Result<T, E>` discriminated on `ok`) as ADR-001 §2 prescribes. It is the first code in `shared/`, kept minimal (no `map`/`chain` helpers until a second caller needs them).

### D9 — Test strategy (PROC-tdd)

- **Domain:** table-driven Vitest tests with fictitious dish names, one per spec scenario of filler, recipe resolution and `WeeklyMenu` building (14 meals, positions, empty Sunday). The first red test is the MF-11 bug: a marked dish whose best candidate scores below 0.6 must yield `unresolved` carrying the discarded candidate.
- **PDF layout functions:** the same style over strings and `string[][]`, one test per spec scenario of cell splitting and table location.
- **Use case:** in-memory `DocumentSource` and `MenuRepository` fakes for ordering, per-menu errors, "no save when nothing parsed", the QA rows and the unresolved list.
- **Infrastructure:** `JsonFileMenuRepository` against a temp directory (exact JSON shape, no scores). The `local-document-source` listing, `.pdf`-only filter, non-recipe exclusions and missing-file cases run against a temp directory with empty placeholder files. The `pdf-parse` table extraction is covered only by the parity run on real data, because a synthetic PDF with a real table is costly to generate and would test the library, not our code.
- **CLI:** the command function with a fake use case and in-memory writers, covering unknown argument → code `2` with nothing called, partial failure → `1`, unresolved dishes → `0`, console lines, CSV columns (empty `match_receta` for unresolved dishes), and paths kept inside the data directory.

## Risks / Trade-offs

- [The `pdf-parse` call has no automated test] → The parity run (Migration Plan step 2) exercises it on all 36 menus. The I/O part stays thin ("first table of the first page" and error mapping); the layout logic is in the tested `pdf/` functions.
- [Layout functions in `infrastructure` are pure only by convention] → Kept in `pdf/` with string-only tests; any I/O stays in `local-document-source.ts`.
- [The dataset format changes, so parity is no longer a file diff] → A one-off local comparison script maps the old `MenuJson[]` to `WeeklyMenu` and compares them menu by menu and dish by dish. It is not committed as a test, because the data is gitignored.
- [`.pdf`-only candidates and the new unresolved report change the counts against T2 §2.5 (591 matched, 0 unresolved)] → Intended (roadmap MF-11). The current JSON already shows unresolved dishes with a score (e.g. `scoreMatch: 0.4` with `recetaFichero: null` in menu 1), so there may be more than the two cases in menu 10 the roadmap describes. Every difference must be explained as a `.txt` without a `.pdf`, a genuinely missing recipe, or a filter error. T2 §2.5 and `context/datos.md` get the new numbers.
- [The breakfast-prefix filter may be hiding a non-breakfast recipe (roadmap MF-11, menu 10 case)] → Investigated during apply. If it does, the fix is to tighten the prefixes in the domain, with a regression test using a fictitious name.
- [The JSON file is the entity serialized as it is] → Accepted because the file is temporary (D4); an adapter test fixes its shape.
- [The first backend slice sets conventions (Result shape, port naming, test layout) that later slices will copy] → D8 keeps `Result` minimal, and the ports use the names ADR-001 §4 already gives.
- [Real dish names reach stdout] → Local tool only, as today. Nothing goes to Sentry or the repo; QA files stay in `data/qa/` (gitignored).

## Migration Plan

1. Implement D1–D8 test-first (ADR-001 §4 already amended with the D2 criterion during planning). Add `tsx` and the `ingest` script, and keep `datos:menu` in the meantime.
2. **Parity:** keep the output of `pnpm datos:menu`, run `pnpm ingest menu` on the same `data/raw`, and compare the two with the one-off mapping script. Every difference must be explained (see Risks / Trade-offs); the result is recorded in the change's tasks.
3. Run the roadmap's cross-check: the recipes `datos:recetas` extracts vs. the ones `ingest menu` resolves.
4. Remove `scripts/datos/parse-menu-pdftable.js` and the `datos:menu` script, and nothing else from `scripts/datos/`, since the other three scripts are still in use.
5. Update the docs: `context/tareas/T2-esquema-json-ingesta.md` §2 (new format; `scoreMatch` leaves the dataset; updated §2.5 numbers), `context/tareas/T0-extraccion-previa.md` (command), `context/decisiones.md` (ING-menu-json, ING-parser-menu, ING-trazabilidad name the old script), `context/datos.md` (coverage numbers, if they change), and MF-11/MF-14 in `context/roadmap.md` (MF-14 reads the new format).

Rollback: until step 4, `pnpm datos:menu` still works, although it writes the old format to the same file. After step 4, revert the removal commit.
