# Design

## Context

`findMenus` (`src/application/services/search/find-menus.ts`) scores every distinct term with one strategy (`scoreTerms`) and builds a `ScoredDish` per dish with a score per constraint id (`toScoredMenu`). `filterByHardUnits` (`src/domain/search/hard-constraints.ts`) drops the menus that break a `hard` unit, and already decides a week-wide exclusion as "no dish of its slot matches the term" (`satisfiesUnit`). `scoreMenu` (`src/domain/search/score-menu.ts`) gives a week-wide exclusion `1 / (1 + n)` and averages every unit. The lexical match exists as a port (`DishTextSearch.matches`), used today only by the `lexical` and `hybrid` strategies.

## Goals / Non-Goals

**Goals:**
- A week-wide exclusion removes the menus whose dishes contain the term lexically, with every strategy, `hard` or not.
- It leaves the menu score; the other units order the menus.
- Measure the effect on the retrieval golden set.

**Non-Goals:**
- Synonyms or food groups (cerdo → jamón; gluten). Declared as a limitation (`context/decisiones.md` BUS-superficie-consulta (b)).
- Exclusions inside a group: they stay semantic.
- The card of `/planner` (MF-61) and the decomposer.

## Decisions

### D1. The lexical score replaces the strategy's score for week-wide exclusions

`findMenus` computes, besides the strategy's scores, the lexical scores of the terms of the week-wide exclusions (`DishTextSearch.matches`, 0 or 1). `toScoredMenu` gives each week-wide exclusion's constraint id its lexical map instead of the strategy's. A term used both as a week-wide exclusion and elsewhere keeps both maps, so the lookup is by constraint, not by term.

Because a lexical score is 0 or 1 and every threshold is 0.5 or 0.75, the existing `matchesConstraint` and `satisfiesUnit` decide "contains the word" with every strategy: no change to the matching rule. Alternative rejected: a separate code path for exclusions in the domain, which would duplicate the slot handling of `satisfiesUnit`.

With the `lexical` strategy nothing changes: its scores already are the lexical ones. The terms of the week-wide exclusions leave the terms scored with the strategy, so they are not embedded, and a term is matched by text twice only when it is both a week-wide exclusion and another constraint.

### D2. Week-wide exclusions always filter

`filterByHardUnits` treats a unit as filtering when it is `hard` or a week-wide exclusion (`isWeekWideExclusion`). `removedBy` then counts them too, with no change of shape. The rename to "filter" is only in the CLI text (`Filter c2 removes 15 menus.`, `No constraint filters the menus.`); the DTO keeps `removedBy`. `ingest search-text` prints the ranking as `ingest search` does, so it changes with it.

### D3. Week-wide exclusions leave the mean

`scoreMenu` keeps one `UnitScore` per unit, so the evidence stays aligned with the units (spec `menu-search`, "Top five and ties", and the planner's alignment check), and gives a week-wide exclusion `{ score: 1, evidence: null }`; the menu score is the mean of the other units, and 1 when there are none. A kept menu has no matching dish for the exclusion, so 1 is its true unit score; it is left out of the mean so that it does not lift weak menus over the minimum of 0.6 (with `pollo` at 0.4, counting it would give 0.7). `weekWideExclusionScore` is deleted.

### D4. E07 leaves the retrieval golden set through its rule

E07's rule in `evals/retrieval/queries.json` becomes `{ "kind": "withdrawn", "reason": "…" }` and `pnpm evals:golden-set` regenerates `golden-set.json` and its report, as for the other withdrawn queries. The decomposer golden set is not touched.

## Risks / Trade-offs

- **No synonyms** ("sin cerdo" keeps "Acelgas con jamón", "Tortilla con tacos de serrano") and **no categories** ("marisco" 1 dish, "gluten" and "lactosa" 0) → declared limitation; measured with `pnpm evals:exclusion-strategies`.
- **Exclusions empty the ranking often** ("sin huevo" 0 menus, "sin pollo" 2) → intended by the author: the answer is the data. The planner already says that no menu fits (spec `menu-planner`, "No menu fits").
- **The exclusion numbers of MF-14 change** → that is the point; `evals/search/results.md` is regenerated and the change of the exclusion row is reported in the PR.
- **One more query per excluded term** with `semantic` → read only and local to the database; no Gemini call.

## Migration Plan

None: no schema or data change. The behaviour changes on deploy.

## Open Questions

None.
