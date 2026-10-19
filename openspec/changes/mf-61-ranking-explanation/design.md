# Design: MF-61 deterministic explanation on the top-5 cards

Visual source: the design system "Menu Finder Design System" (<https://claude.ai/code/artifact/2b9c8f4b-b06b-4b2d-a22a-221b23edc61a>), version `1792433417-7fa2` (the author's "versión 59"):

- `ui_kits/app/PlannerScreen.jsx`: the results heading, the case of only exclusions and the empty state.
- `components/recipe/MenuCandidateCard.jsx`: the states ✓ / ≈ / ✕ (`ok`, `near`, `none`), "parecido: " and the `summary` under "Menú N".

The tokens do not change: `olive-600`, `ochre-700` and `terracotta-600` are already in `design-system/tokens.json`.

## Context

The search returns, for each unit of a menu, the dish with the best unit score (`bestDish`, `src/domain/search/score-menu.ts`). With the `semantic` strategy the scores are rescaled per term over every dish (`rescaleSimilarities`), so nearly every unit has a dish, however far, and a literal dish loses to a more similar one. The view (`src/features/menu-planner/search-view.ts`) turns each evidence item into a line with a check or a cross.

## Goals / Non-Goals

**Goals:** say how much of the request each menu meets, and tell a literal dish from a similar one, with the data the search already has and without an LLM.

**Non-Goals:** change the score or the ranking; say "no hay" when the request is not in the menus (MF-71 and future work); show how many menus each filter removes (MF-65); the "Prueba con" suggestions of the mock.

## Decisions

### D1. The evidence is picked in the domain, in three steps

`bestDish` becomes `unitEvidence(unit, dishes, strategy)` in `src/domain/search/score-menu.ts`, which returns `{ score, evidence, match }`:

1. the first dish, in menu order, that holds the unit word for word (`literal`);
2. otherwise the best-scoring dish when `matchesTerm(score, strategy)` (`similar`), the same rule and threshold as the hard filter (`MATCH_THRESHOLD`, `src/domain/search/term-score.ts`);
3. otherwise none (`none`).

The **score** of the unit stays the best dish score, so `scoreMenu` and the ranking do not change; only the dish shown and its kind do.

"Word for word" per unit kind, in `src/domain/search/constraint-unit.ts` (`holdsLiterally`): an ungrouped `include` constraint, the text match of its term in its slot; a `sameDish` group, the text match of every `include` member, and `keepsConstraint` (the rule of the hard filter, with the strategy of the search) for every `exclude` member, all in the slot of every member; an `anyOf` group, the text match of any `include` member in its slot. A unit with no `include` member has no literal dish.

- **Alternative rejected:** decide "literal" in the view by looking for the term in the dish name. It misses the recipe title and the ingredients, the accents and the plural that the text match of the lexical strategy handles ("Text match of a term"), so the card would disagree with the search.
- **Alternative rejected:** any dish with a score above 0, as today. With the semantic strategy almost no line would be ✕, and the summary would say "Cumple las 3" for menus whose "similar" dish has nothing to do with the request (decided by the author on 2026-10-19).

### D2. `ScoredDish` carries the literal match of each constraint

`ScoredDish` gains `literal: Readonly<Record<string, boolean>>`, keyed by constraint id like `scores`. `findMenus` fills it from the text match (`DishTextSearch.matches`, an existing port; no new port, AGENTS.md "reuse a port"):

- `lexical`: the lexical scores are the text match, so `literal` is `score === 1`.
- `hybrid`: the lexical scores are already computed before they are combined; they are kept apart for `literal`.
- `semantic`: `lexicalScores` runs for the distinct terms scored with the strategy, after the embeddings. One more query per distinct term, no call to the model. A failure is `search-failed`, like any database failure, and there is no partial ranking.

The week-wide exclusions already use the text match and are left as they are: their evidence is always `none`.

### D3. `EvidenceDto` gains `match`

```ts
type EvidenceDto = { constraints: string[]; dish: DishDto | null; match: 'literal' | 'similar' | 'none' };
```

`match` is `none` exactly when `dish` is null. The CLI prints the kind beside the dish (`rankingLines`, `src/cli/commands/search.ts`), which `search-text` reuses. The evaluation reads only the ranking, so its numbers do not change.

### D4. The view builds the state, the summary and the heading

In `src/features/menu-planner/search-view.ts`, pure functions:

- `EvidenceLine` replaces `found: boolean` with `state: 'met' | 'similar' | 'unmet'`; `toLine` maps `literal` → `met`, `similar` → `similar` with "parecido: " before the detail, and no dish → `met` "no aparece en la semana" when all members exclude, `unmet` "ningún plato" otherwise.
- `summarize(lines)` returns the fixed sentence of the spec from three counts. The numbers of ≈ lines are written in words up to ten ("una", "dos", … "diez"), as the mock does, and in digits above.
- `PlannerSearchState` gains `onlyExclusions: boolean` (every chip is an ungrouped exclusion), and `CandidateCard` gains `summary: string | null` (null when `onlyExclusions`).

The view never puts a term, a dish or any search text into the summary: it is built only from counts, so a prompt injection in the request cannot reach it (`context/safety-first.md` §2.6).

### D5. Components

- `MenuCandidateCard`: "Menú N" as an `h3` in place of the badge, the summary under it, the rank only when there is one, and the state symbol of each line (✓ `olive-600`, ≈ `ochre-700`, ✕ `terracotta-600`), hidden from screen readers like the icons today. Notes the design system version.
- `PlannerResults`: the eyebrow ("Los N que mejor encajan", "El que mejor encaja" or "Todos cumplen lo que pides") and the `h2` "Resultados", the line of the ties for only exclusions, and the empty state as an `h2`.

Both stay in `src/features/menu-planner/` (Scope Rule, ADR-001 §2): no other feature uses them.

## Risks / Trade-offs

- **[A literal dish with a low score is shown before a better similar one]** → intended: the card claims only what the text proves. The score of the unit, and the ranking, still come from the best dish.
- **[Extra database queries with the semantic strategy]** → one `phraseto_tsquery` per distinct term over 608 dishes, the query the lexical strategy already runs; bounded by the terms of one request of at most 300 characters.
- **[The summary for a single unit with a similar dish reads "Cumple lo que pides, una con un plato parecido."]** → accepted, as the mock has no wording for that case; the author can change it in `verify` against the mock.
- **[A group of only exclusions ("ni cerdo ni ternera" as `anyOf`)]** → no literal dish exists, so it is `similar` or `none`; with no dish it reads "no aparece en la semana" as today.

## Deviations

None. No new port: the text match reuses `DishTextSearch`.
