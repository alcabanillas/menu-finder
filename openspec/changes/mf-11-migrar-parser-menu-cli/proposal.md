# Proposal

## Why

`scripts/datos/parse-menu-pdftable.js` extracts the menu JSON (`data/menu-platos.json`, contract T2 §2) but lives outside the hexagon (ADR-001 §2: "scripts/datos/... se sustituyen por la CLI de ingesta"), untested, and its QA reporting hides real problems: a dish marked `*` in the PDF whose best fuzzy-match candidate falls below `MATCH_THRESHOLD` is correctly resolved to `null` in the JSON, but the QA CSV writes that discarded candidate into `match_receta` as if it were a valid match, and the console only prints a total count with no menu/day/dish to act on. MF-11 asks to fix both; doing it in place would duplicate the work MF-16 (ING-cli-local) will redo later. This change does the ING-cli-local migration now, scoped to only the menu leg, with TDD (PROC-tdd) so the fix ships with regression coverage.

## What Changes

- Extract the pure logic (`splitCellIntoDishes`, `normalize`, `containment`, `bestMatch`, header/label row lookup) into `src/domain/menu-ingestion/`: functions tested with plain strings/arrays, no PDF or filesystem I/O.
- Add a `DocumentSource`-shaped port (ADR-001 §4) in `src/application/ports/` for listing a menu folder's recipe files and reading `menu.pdf`, with a single `src/infrastructure/` implementation backed by `pdf-parse` and the local filesystem (replaces the raw `fs`/`pdf-parse` calls currently inline in the script).
- Add a use case in `src/application/use-cases/` that orchestrates: read the menu table, split cells into dishes, resolve each `*` dish against the recipe file list, and produce both the `MenuJson[]` (T2 §2.2 contract, unchanged shape) and a QA report model.
- Add a CLI command under `src/cli/commands/` (thin adapter, ADR-001 §5: parse args, call the use case, map `Result` to exit code/stdout) that replaces `pnpm datos:menu`'s current entry point.
- **Fix (behavior change):** the QA report never lists a below-threshold candidate as `match_receta`; a `*` dish that resolves to `null` is instead surfaced explicitly — in the console output and in the QA report — with menu, day, meal, dish name, best discarded candidate and its score, so the case is actionable without opening the CSV by hand.
- Remove `scripts/datos/parse-menu-pdftable.js` and its `pnpm datos:menu` script once the CLI command reaches parity (same `data/menu-platos.json` output verified against the current dataset).
- Unit tests (Vitest, OPS-calidad) for the domain functions and the use case, written before the implementation (PROC-tdd): the first test reproduces the reported bug (a `*` dish with no recipe file present, or one whose file name scores below `MATCH_THRESHOLD`) and must fail against the current script's logic before the fix.

Out of scope (stays for MF-16 later): the shopping-list leg, recipe enrichment (`totalTimeMin`, food-group table, season), recipe version selection, and DB loading. This change only touches the menu leg (T2 §2) already closed by ING-menu-json/ING-parser-menu.

## Capabilities

### New Capabilities
- `menu-ingestion`: parses `data/raw/Dieta/Menu <n>/menu.pdf` into the `MenuJson[]` structure (T2 §2.2), resolving each `*`-marked dish to a recipe file by fuzzy match, and reports every `*` dish left unresolved (menu/day/meal/dish/best discarded candidate/score) instead of only counting them.

### Modified Capabilities
_None — no existing spec covers this today (`openspec list --specs` returns none)._

## Impact

- **Code:** new `src/domain/menu-ingestion/`, `src/application/ports/`, `src/application/use-cases/`, `src/infrastructure/menu-ingestion/`, `src/cli/commands/parse-menu.ts` (or similar), `src/composition/cli-container.ts` wiring. Removes `scripts/datos/parse-menu-pdftable.js` and the `datos:menu` script in `package.json` (kept only until parity is verified).
- **Data:** reads `data/raw/Dieta/Menu <n>/menu.pdf` and sibling recipe PDFs (gitignored, SEG-datos-nutricionista — no nutritionist branding/contact data is introduced by this change, same as today). Writes `data/menu-platos.json` (same contract, T2 §2) and the QA report (now also readable from the console).
- **Security:** local-only CLI command, no network, no new stored data, no new abuse surface (SEG-owasp) — this is tooling run by the author on their machine (ING-cli-local), not app code reachable by a request.
- **Dependencies:** none new; keeps `pdf-parse`.
- **Roadmap:** implements MF-11 (`context/roadmap.md`) as a partial, early slice of MF-16 (ING-cli-local).
