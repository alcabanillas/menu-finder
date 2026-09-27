# Proposal

## Why

`scripts/datos/parse-menu-pdftable.js` extracts the menu JSON (`data/menu-platos.json`, contract T2 §2) but lives outside the hexagon (ADR-001 §2: "scripts/datos/... se sustituyen por la CLI de ingesta"), untested, and its QA reporting hides real problems: a dish marked `*` in the PDF whose best fuzzy-match candidate falls below `MATCH_THRESHOLD` gets `recetaFichero: null` in the JSON, but the QA CSV writes that discarded candidate into `match_receta` as if it were a valid match, and the console only prints a total count with no menu/day/dish to act on. The JSON is also inconsistent with its own contract: it keeps the discarded candidate's `scoreMatch` (e.g. `0.4`) where T2 §2.3 says it is `null`. MF-11 asks to fix these; doing it in place would duplicate the work MF-16 (ING-cli-local) will redo later. This change does the ING-cli-local migration now, scoped to only the menu leg, with TDD (PROC-tdd) so the fix ships with regression coverage.

The script's output shape (Spanish keys, `dias` → `comida`/`cena`, match evidence mixed into each dish) is not the shape the data will have in the database (ARQ-modelo-datos: `Menu` → `Meal` → `MenuDish`). No code reads `data/menu-platos.json` yet (the first reader will be the T3 spike, MF-14), so this is the cheapest moment to align it with the domain model.

## What Changes

- Add the menu entity `WeeklyMenu` (`Meal`, `MenuDish`) to `src/domain/menu/`, mirroring ARQ-modelo-datos. It is the ingestion's output and what MF-16 will persist; match evidence (score, discarded candidate) is not part of it.
- Extract the script's logic into pure functions tested with plain strings/arrays, no PDF or filesystem I/O, split by what changes with the source: the rules that hold for any source (filler, `normalize`, `containment`, `bestMatch`, `WeeklyMenu` building) go to `src/domain/menu-ingestion/`; the PDF layout parsing (`splitCellIntoDishes`, header/label row lookup) goes to the PDF adapter in `src/infrastructure/menu-ingestion/pdf/`. This amends the example in ADR-001 §4, which put document parsing in the domain.
- Add a `DocumentSource` port (ADR-001 §4) in `src/application/ports/` for listing menu folders and recipe files and reading each menu as a source-agnostic structure (meals with dish names and marks), with a single `src/infrastructure/` implementation backed by `pdf-parse` and the local filesystem.
- Add a `MenuRepository` port (ADR-001 §4) with `saveAll(WeeklyMenu[])`, implemented for now by a JSON-file adapter that writes `data/menu-platos.json`; MF-16 replaces it with the database adapter without touching the use case.
- Add a use case in `src/application/use-cases/` that orchestrates: read each menu table, split cells into dishes, resolve each `*` dish against the recipe file list, save the `WeeklyMenu[]` through `MenuRepository`, and return an ingestion summary DTO (errors, totals, unresolved dishes with their discarded candidate and score).
- Add a CLI command under `src/cli/` (thin adapter, ADR-001 §5: parse args, call the use case, present its summary on the console and as the QA report files, map `Result` to exit code) that replaces `pnpm datos:menu`.
- **Breaking change to the dataset format:** `data/menu-platos.json` becomes the serialization of `WeeklyMenu[]` (English keys, numeric menu number, meals as a list) instead of the T2 §2.2 `MenuJson[]`; `scoreMatch` leaves the dataset and lives only in the QA report. T2 §2 is rewritten accordingly.
- **Fix (behavior change):** the QA report never lists a below-threshold candidate as `match_receta`; a `*` dish that resolves to `null` is instead surfaced explicitly — in the console output and in the QA report — with menu, day, meal, dish name, best discarded candidate and its score.
- **Fix (behavior change):** recipe candidates are the menu folder's `.pdf` files only; the script also counts stray `.pdf.txt` files as existing recipes (roadmap MF-11).
- Remove `scripts/datos/parse-menu-pdftable.js` and its `pnpm datos:menu` script once the CLI command reaches parity (equivalent content verified against the current dataset, differences explained).
- Unit tests (Vitest, OPS-calidad) for the domain functions, the use case, the adapters that touch the filesystem, and the CLI command, written before the implementation (PROC-tdd): the first test reproduces the reported bug (a `*` dish whose best candidate scores below `MATCH_THRESHOLD`, or with no recipe file at all).

Out of scope (stays for MF-16 later): the shopping-list leg, recipe enrichment (`totalTimeMin`, food-group table, season), recipe version selection, mapping recipe file names to recipe ids, and DB loading. This change only touches the menu leg (T2 §2) already closed by ING-menu-json/ING-parser-menu.

## Capabilities

### New Capabilities
- `menu-ingestion`: parses `data/raw/Dieta/Menu <n>/menu.pdf` into `WeeklyMenu[]`, resolving each `*`-marked dish to a recipe file by fuzzy match, saves the menus, and reports every `*` dish left unresolved (menu/day/meal/dish/best discarded candidate/score) instead of only counting them.

### Modified Capabilities
_None — no existing spec covers this today (`openspec list --specs` returns none)._

## Impact

- **Code:** new `src/shared/result.ts`, `src/domain/menu/`, `src/domain/menu-ingestion/`, `src/application/ports/` (`DocumentSource`, `MenuRepository`), `src/application/use-cases/`, `src/application/dto/`, `src/infrastructure/menu-ingestion/` (with `pdf/`), `src/cli/index.ts` and `src/cli/commands/`, `src/composition/cli-container.ts`. Removes `scripts/datos/parse-menu-pdftable.js` and the `datos:menu` script in `package.json` (kept only until parity is verified).
- **Data:** reads `data/raw/Dieta/Menu <n>/menu.pdf` and sibling recipe PDFs (gitignored, SEG-datos-nutricionista — no nutritionist branding/contact data is introduced by this change, same as today). Writes `data/menu-platos.json` in the new `WeeklyMenu[]` format and the QA report under `data/qa/` (now also readable from the console).
- **Docs:** `context/tareas/T2-esquema-json-ingesta.md` §2 (new format and semantics), `context/tareas/T0-extraccion-previa.md` (command), `context/decisiones.md` (ING-menu-json, ING-parser-menu, ING-trazabilidad name the old script), `context/datos.md` §coverage figures if they change, and MF-11/MF-14 in `context/roadmap.md` (MF-14 reads the new format).
- **Security:** local-only CLI command, no network, no new stored data, no new abuse surface (SEG-owasp) — this is tooling run by the author on their machine (ING-cli-local), not app code reachable by a request.
- **Dependencies:** adds `tsx` (devDependency) to run the TypeScript CLI; keeps `pdf-parse`.
- **Roadmap:** implements MF-11 (`context/roadmap.md`) as a partial, early slice of MF-16 (ING-cli-local).
