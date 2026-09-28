# Proposal

## Why

Roadmap item **MF-12**. The retrieval comparison (MF-18: lexical vs. semantic vs. hybrid, per query type, EVAL-estrategia, BUS-superficie-consulta (d)) is pillar 2 of the thesis (PROC-enfoque) and needs a golden set labelled **before** the search engine exists (EVAL-golden-sets, roadmap "etiquetar antes de construir"). The labelling was done on 2026-09-28 with throwaway scripts and the author's review; this change turns that result into a reproducible artefact with a stable format that MF-18 can read, following the path of the menu and recipe parsers: a local script first (`scripts/`, runbook T0), a migration to the CLI later if MF-18 needs it.

## What Changes

- Add `scripts/evaluacion/build-golden-set.js` (`pnpm evals:golden-set`). It reads the weekly menus and recipes from `data/`, the labelling inputs from `evals/retrieval/` and the author's literal review from `data/golden/`, and writes:
  - `evals/retrieval/golden-set.json` (committed): per query, its type, text, status (kept / withdrawn with reason) and a grade `0|1|2` for each of the 36 menus.
  - `data/golden/golden-set-report.md` (gitignored): per query and menu, the dishes that justify the grade; the withdrawn queries; the author's rejections and the precision of the LLM labeller.
- Add `scripts/evaluacion/literal-candidates.js` (`pnpm evals:literal-candidates`): the high-recall matcher that proposes literal candidates for the author's review, written to `data/golden/literal-candidates.md`.
- Commit the labelling inputs to `evals/retrieval/`: `queries.json` (queries, their origin and their rule), `dish-labels.json` (per concept: criteria, dishes labelled by the LLM, dishes rejected by the author) and `ingredient-groups.json` (ingredient → group table).
- The relevance rules per query type, stated in the spec so the golden set is reproducible and MF-18 knows what a grade means:
  - **literal**: 2 = the term is in the dish name, 1 = only in its ingredients; the author's review of the candidates is the truth (e.g. `salmonete` is not `salmón`).
  - **exclusion**: count of dishes per menu that break it, graded relative to the 36 menus (no menu is free of fish, egg, legume or dairy, BUS-superficie-consulta (b)).
  - **attribute**: share of matching dishes (quick = total time ≤ 20 min; a dish without recipe is quick, BUS-superficie-consulta (c); a recipe without total time is missing data), graded relative to the 36 menus.
  - **fuzzy**: count or share of dishes labelled with the concept.
  - **combined**: `X y Y` = each constraint by any dish of the week; `X con Y` = the same dish; exclusions on the week lower the grade (BUS-superficie-consulta (a), (b)).
  - **withdrawal**: a query is withdrawn when no menu is relevant or when more than 30 of the 36 menus get the top grade; it is reported, not deleted.

Out of scope: the search engine and the metrics (MF-18), the decomposer golden set (MF-13), the group table the engine will use for exclusions (MF-16), the migration of these scripts to the CLI.

## Decisions and contradictions

This change **deviates from EVAL-golden-sets** on four points, all decided by the author on 2026-09-28; `context/decisiones.md` is updated when the change is archived:

1. **Five query types, not four.** BUS-superficie-consulta (d) defines four (literal, exclusion, attribute, fuzzy/hypernym); `combined` is added so that "y"/"con" aggregation is measured on its own. With "~8 per type", 40 queries did not add up with four types.
2. **At least 8 queries per type, not 40 in total.** After withdrawals, 44 remain (L10 · E7 · A9 · F8 · C10). E is one short of 8; see the open point below.
3. **Queries were not written by the author.** They were generated blind by an LLM in a separate conversation with no access to the data, and selected and edited by the author; three literal queries are the author's own.
4. **Labels were not produced by the author alone.** Literal candidates come from a high-recall matcher (substring, accent- and plural-insensitive, broader than the planned lexical search on purpose) and the author accepted or rejected each one. Fuzzy concepts and raw fish were labelled per dish by an LLM of another family than the engine's (Claude; IA-proveedor) and reviewed in full by the author (9 rejections out of ~460 labels, ~98 % precision). Ingredient groups were labelled by the same LLM and skimmed by the author. **Declared limitation:** the review measures precision, not recall; a dish the labeller missed is not detected.

Graded relevance (`0|1|2`) replaces "menús relevantes esperados" (a set), because exclusions and combined queries have no clean yes/no.

It also **deviates from PROC-tdd**: the scripts have no unit tests, like `scripts/datos/` (runbook T0), which the CLI replaced later with TDD (MF-11, MF-38). Compensation: the build validates every input and fails closed, checks its own output (only ids, texts and numbers in the committed file; queries and menus in a fixed order), and parity with the 2026-09-28 draft is checked by hand. If MF-18 needs to rebuild the golden set from its code, the migration to the CLI comes with TDD then.

**SEG-datos-nutricionista, as applied here:** dish and ingredient names are facts and may be committed (the decision keeps them); what may not is the brand, email and slogan (none is involved) nor the menus themselves ("no forman parte del repositorio", in the mandatory citation). So the committed files never say which dishes a menu has: the labels map concepts to dishes, the golden set maps queries to menu numbers, and the per-menu evidence stays in `data/`.

**Open point for the author:** E has 7 queries. Either one exclusion query is added (generated blind) or E stays at 7 and the deviation is recorded.

## Capabilities

### New Capabilities
- `retrieval-golden-set`: builds the graded retrieval golden set (queries, per-menu grades, withdrawals and report) from the labelling inputs, with the relevance rules per query type.

### Modified Capabilities
_None._

## Impact

- **Code:** new `scripts/evaluacion/build-golden-set.js` and `scripts/evaluacion/literal-candidates.js`; `package.json` gains `evals:golden-set` and `evals:literal-candidates`. Nothing in `src/` changes.
- **Data:** reads `data/menu-platos.json`, `data/recetas.json` and `data/golden/literal-candidates.md` (gitignored). Commits `evals/retrieval/{queries,dish-labels,ingredient-groups,golden-set}.json`, with dish and ingredient names but no menu composition. Writes the per-menu report to `data/golden/` only.
- **Security (safety-first P1, SEG-owasp):** a local script run by the author, no network, no credentials, fixed input and output paths (no path from arguments). Abuses considered: a malformed or tampered input file (A08) → every input is validated and the script fails closed naming the file and field, writing nothing; the menus leaking to the public repo (SEG-datos-nutricionista) → the committed files carry no menu → dish mapping, and the script checks it before writing. No new dependency.
- **Decisions relied on:** EVAL-golden-sets (with the deviations above), EVAL-estrategia, BUS-superficie-consulta (a)–(d), BUS-unidad-plato, BUS-discrimina-plato, IA-proveedor, SEG-datos-nutricionista, PROC-sdd; PROC-tdd with the deviation above.
- **Findings for the thesis:** with "y" meaning "any dish of the week", pairs of common ingredients saturate ("pollo y arroz": 31 of 36 menus at the top grade); what discriminates is "con" (the same dish) and rare items, consistent with BUS-discrimina-plato. An LLM judging whole menus failed (Haiku skipped 27 of 39 queries and rated all 36 menus relevant for "marisco"); labelling per dish reached ~98 % precision.
- **Docs:** `context/decisiones.md` (EVAL-golden-sets), `context/roadmap.md` (MF-12), `context/tareas/T0-extraccion-previa.md` (how to rebuild the golden set).
