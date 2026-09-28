# Design

## Context

See proposal.md — Why. Requirements are in `specs/retrieval-golden-set/spec.md`.

Current state that shapes the approach:

- The labelling was done on 2026-09-28 with two throwaway scripts, kept in `data/golden/scripts/` (`literal-candidates.js`, `build-golden.js`), which left in `data/golden/`: `menus-slim.json` (menus joined with recipe ingredients and total time), `literal-candidates.md` (the author's ✅/❌ review of literal candidates), `ingredient-groups.json` (256 ingredients in groups, derived groups and ambiguous rows), `dish-labels-review.md` (dish lists per concept with the author's ❌), `queries.json` / `queries-literal.json` (the query texts) and `golden-draft.json` (the draft grades). In `build-golden.js` the dish lists are positions in an alphabetical list and the rules are one function per query id.
- `scripts/datos/` sets the precedent: CommonJS scripts run with `node`, `package.json` scripts named `datos:*`, `require()` allowed by ESLint for `scripts/**/*.js`, no unit tests, replaced later by the CLI.
- `data/` is gitignored; `evals/` does not exist yet.

## Goals / Non-Goals

**Goals:**
- A golden set that anyone with `data/` can rebuild with one command, from inputs that are committed and readable (except the literal review and the dataset itself).
- Rules as data (`queries.json`), interpreted by one script, instead of one function per query.
- Parity with `golden-draft.json`, except where this design fixes a known defect (D5).

**Non-Goals:**
- Unit tests and the hexagon: deferred to a possible CLI migration (proposal, PROC-tdd deviation).
- Regenerating the LLM dish labels: that is a new labelling round, not part of this build.
- Metrics (MF-18).

## Decisions

### D1 — Files

| File | Where | Content |
|---|---|---|
| `scripts/evaluacion/build-golden-set.js` | repo | Builds the golden set. |
| `scripts/evaluacion/literal-candidates.js` | repo | Proposes literal candidates for review. |
| `evals/retrieval/queries.json` | repo | Queries (`id`, `type`, `text`, `origin`) and their rule. |
| `evals/retrieval/dish-labels.json` | repo | Per concept: `criteria`, `labels` (dish names, by the LLM), `rejected` (by the author). |
| `evals/retrieval/ingredient-groups.json` | repo | The table, with `pescado_curado_ahumado` holding the smoked and cured fish that the draft had inside the script. |
| `evals/retrieval/golden-set.json` | repo | Output. |
| `data/golden/literal-candidates.md` | local | The author's literal review: it lists dishes under menu numbers, so it stays out (proposal, SEG-datos-nutricionista). |
| `data/golden/golden-set-report.md` | local | Output with per-menu evidence. |

`dish-labels.json` moves the author's ❌ from `dish-labels-review.md` into `rejected`, so labels and review live in one committed file and the precision per concept can be recomputed by anyone. Folder name `scripts/evaluacion/` follows `scripts/datos/`.

### D2 — Rules as data

Each query in `queries.json` carries one rule:

```js
// concept: an ingredient group, a derived group, a dish concept, "quick" or "quick-under-20"
{ kind: "literal" }                                         // grades from the literal review
{ kind: "exclusion", concept }
{ kind: "share", concept, slot? }                            // concept may be an array: all of them in the same dish
{ kind: "presence", concept }
{ kind: "cover", concepts: [...] }                           // "X y Y"
{ kind: "sameDish", all: [...], main, without? }             // "X con Y", "X sin Z" bound to the dish
{ kind: "coverExcluding", concepts: [...], excluding }       // "X y Y sin Z" on the week
{ kind: "withdrawn", reason }
```

The script interprets the rule; nothing is evaluated from strings. *Alternative:* keep one function per query, as the draft. Rejected: rules hidden in code are not auditable, and they would not survive a migration to the CLI as data.

### D3 — Script structure

One file, but split in pure functions with no I/O (`load`, `validate`, `dishFacts`, `matches`, `relativeGrade`, `gradeQuery`, `withdrawalOf`, `serialize`, `formatReport`) and a `main` that does the reading and writing. That is what a CLI migration would move: the pure functions to `src/domain/evaluation/`, the reading to an adapter, `main` to a command. The script validates everything first and collects all errors (spec *Input validation*); it writes only when there are none.

The menus come from `data/menu-platos.json` and `data/recetas.json` joined by `recipeFile` (the draft used a derived `menus-slim.json`, which disappears). Literal review parsing: a `## <id> "<text>"` header opens a query; `- [<mark>] **Menu <n> → <g>**` is a candidate, rejected when `<mark>` contains ❌, accepted otherwise, with the grade `<g>` as left by the author.

### D4 — Self-checks instead of unit tests

Before writing, the script checks its own output: every kept query has one grade per menu in `0..2`; no dish name of the menus appears in the golden set text; queries sorted by id and menus by number, no timestamp. A failed check exits with `1` and writes nothing. *Alternative:* a Vitest file for the script. Rejected for now: it would test a CommonJS script outside `src/` that is meant to move; the tests belong to the migration.

### D5 — Known defect fixed against the draft

The draft treated a recipe whose total time is `null` as quick (`null <= 20` is true in JavaScript). The spec makes it unknown. Parity with `golden-draft.json` is checked query by query, and every difference must be explained by this fix.

## Risks / Trade-offs

- [No unit tests] → the rules are simple and stated in the spec with examples; the self-checks guard the output; parity is checked against the draft; the CLI migration brings the tests.
- [Recall of the labeller is not measured] → declared in the report and the thesis.
- [Labels are keyed by dish name] → if a later ingestion renames a dish, validation fails naming it, and the author re-reviews it; nothing is silently dropped.
- [Grades are relative to the 36 menus] → the dataset is closed (producto.md §2); adding menus means rebuilding, which is one command.
- [The author has now seen the data] → the golden set is frozen when this change is archived; any later change to a label or rule goes through a new OpenSpec change that records why, and never after seeing MF-18 results for that query without saying so.

## Migration Plan

1. Write the committed inputs from the draft files (tasks, group 1).
2. Build, compare with `golden-draft.json` (D5), commit.
3. Move Haiku's discarded outputs (`out-l1.json`, `queries-result.json`) to `data/golden/discarded/` as evidence for the thesis; delete `menus-slim.json`, `queries.json`, `queries-literal.json`, `golden-draft.json`, `dish-labels-review*.md` and `data/golden/scripts/` from `data/golden/` once parity is recorded.

## Open Questions

- Whether E gets an eighth query (proposal, open point). It is one more entry in `queries.json` and a rerun.
