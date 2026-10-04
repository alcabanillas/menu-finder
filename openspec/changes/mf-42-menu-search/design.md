## Context

See `proposal.md` for the motivation. Constraints that shape the approach:

- **Hexagon (ADR-001):** `domain` imports nothing outside `domain` and `shared`, not even libraries. `cli` imports only `composition/cli-container`, application DTOs and use cases. A port exists only at a real external boundary: here the database and the embedding service. The CLI is the primary adapter; there is no web adapter in this change.
- **Data:** the tables and embeddings of `mf-41-search-index`: 36 menus, 504 meals, 608 menu dishes, 448 recipe rows with one embedding each. The dataset is tiny: every query can score all dishes.
- **Input:** the structure of `evals/decomposer/golden-set.json` (MF-13), whose schema is in `evals/decomposer/golden-set-schema.ts`.

**Status of the decisions below:** the author decided the open points of task 1.1 on 2026-10-04 (R1, R4, R6, R7, the ports and the migration number), and they are folded in here. D4 and D6 are not recorded in `context/decisiones.md` until task 7.1.

## Goals / Non-Goals

**Goals:**
- One scoring function that works the same with the three strategies, so that the comparison differs only in how a term is matched.
- Pure scoring logic in `domain/search/`, tested with strings and numbers, no database.

**Non-Goals:**
- The evaluation against the golden sets and nDCG: `mf-14-search-evaluation`.
- Enrichment (food groups, `totalTimeMin`, season), user history, normalised ingredients: MF-16.
- The decomposer and the relaxation loop: MF-40 and future work.
- The web adapter: MF-22. Tuning of the hybrid weight.

## Decisions

### D1. Layout and ports

```
domain/search/        request types and rules (ids, polarity, groups), term scoring (rescale, hybrid),
                      unit and menu scoring, hard constraints, ranking   (pure)
application/
  dto/                search-request, search-result: the shapes that come in and go out, independent of the domain
  ports/              DishTextSearch (new); read methods added to MenuRepository and RecipeEmbeddingRepository;
                      EmbeddingsPort comes from mf-41-search-index
  use-cases/          search-menus, with the Zod schema of the request (shape and limits)
infrastructure/
  postgres/           adapters of the three ports above (the migration goes to `postgres/migrations/003-*.sql` at the repository root; `002` is reserved for a parallel change)
  genkit/             query task prefix in the EmbeddingsPort adapter
composition/          cli-container wires them; the search adapters are built only with a database URL
cli/commands/         search
```

The use case reaches the data through three read operations, so the domain scores plain numbers:

- `MenuRepository.list()` (existing port, new method, shared with MF-43): the 36 `WeeklyMenu`.
- `RecipeEmbeddingRepository.similarities(variant, vector)` (existing port, new method): cosine similarity of the term to the dishes' recipes.
- `DishTextSearch.matches(term)` (new port): the dishes with the term as a phrase in their name, recipe title or one ingredient name (D4).

*Why the first two are not new ports (AGENTS.md, reuse a port):* they read the same data the existing repositories write. *Why `DishTextSearch` is new:* no existing port reads dish text for matching, and the match is done by the database (D4). *How a dish is joined to its recipe row* is not in `WeeklyMenu` (it only has `recipeFile`); both `similarities` and `matches` return their results addressed by menu number, day, meal type and dish position, and the adapter does the join (task 4.1).

*Where the request is validated:* the DTO `SearchRequestDto` is the shape that comes from outside, the structure the decomposer (MF-40) will emit, and imports nothing from the domain. It has no golden-set metadata: a golden-set request is the expected output of the decomposer plus `id`, `text` and `origin`, and those are for the evaluation, not for the search, so the CLI drops them when its file is a golden-set request. The use case validates the DTO in two stages and only then turns it into the domain `SearchRequest`. First the shape and the limits, with a Zod schema that `satisfies` the DTO type, so the two cannot drift apart; then the rules across constraints and groups, pure functions in `domain/search/`, which cannot import Zod (ADR-001 §3). A rejected DTO makes no port call, and the CLI and the web share the validation.

*Alternative:* one search port that scores dishes inside SQL. Rejected: the hard-constraint counts and the unit scoring would live in SQL and could not be unit-tested without a database.

### D4. Lexical match: Postgres full-text search with the `spanish` configuration and `unaccent`

A term is turned into a query with `phraseto_tsquery('spanish_unaccent', $1)`: it keeps the words **as a phrase**, in order and with room for the stopwords between them, and **discards operators and punctuation**, so a term is never query syntax and the A05 scenarios hold by construction (the value is also a bind parameter). The phrase is matched against one field at a time, each a `tsvector` **computed in the query**: the menu dish name, the recipe title and each ingredient name. *Why a phrase (decided 2026-10-04):* 18 of the 100 golden-set terms have several words, and almost all are one concept ("judías verdes", "tortilla de patatas", "sardinas en lata"); with the words ANDed anywhere in the dish, "judías verdes" would match white beans with green peppers. *Why one field at a time:* in one joined text, "salmón limón" would match two neighbouring ingredients. Migration `003` adds a text search configuration copied from `spanish` with `unaccent` in its mapping, so that `unaccent()` is not called by hand. A stored `recipe.search_vector` column was rejected: a generated column cannot call `unaccent()` (it is `STABLE`, not `IMMUTABLE`) nor read `recipe_ingredient`, and a plain column would mean changing `PostgresRecipeRepository` of the archived `mf-41-search-index`. Computing it means scanning the 608 dishes on every term; task 1.2 measures the latency, and if it is bad the column is added before the final migration. Tokens are whole words after stemming: "salmón" gives `salmon`, "salmonete" gives `salmonet`, so they differ; "garbanzo" and "garbanzos" give the same stem. With 608 dishes no index is needed.

*Alternatives:* `ILIKE '%term%'` (matches "salmonete" for "salmón", needs escaping of `%` and `_`); `pg_trgm` (fuzzy, not whole-word); matching in application code over the whole catalog (works for the lexical case at this size but does not use the database the product will have, and the comparison is about that stack).

### D5. Term embeddings

The model, dimensions and storage are D5 of `mf-41-search-index`. Terms are embedded with the query task prefix of `gemini-embedding-2`, at most once per distinct term and run.

### D6. Scoring: one dish-score function, fuzzy-logic aggregation

Defined in the spec (`menu-search`). In short: a dish gets a score in [0, 1] for each term; `include` uses it, `exclude` uses one minus it; a `sameDish` group takes the minimum over its members, an `anyOf` group the maximum; a menu takes the best dish per unit and the mean over units; a week-wide exclusion costs `1 / (1 + n)`. A dish "matches" a term at a score of 0.5 or more with the `lexical` and `semantic` strategies and at 0.75 or more with `hybrid` (named constants, fixed before seeing any result); that decides the hard constraints and `n`. The threshold is always applied to the term score, never to `1 −` it: a dish breaks an exclusion only when it matches the term, alone or in a group. Applied to the unit score of a group, `1 − score ≥ 0.75` would move the hybrid line for an exclusion to 0.25, so a dish at 0.3 would break "arroz sin pescado" and not "sin pescado". The hybrid has its own threshold because a mean of 0 and 1 is exactly 0.5, and at 0.5 the most similar dish of every term would always match. A term made only of stopwords gives an empty text query and scores 0 in the lexical part without failing. `search` always uses the direct URL (`DATABASE_URL_UNPOOLED`) and requires `GEMINI_API_KEY` only with `semantic` and `hybrid`.

*Why this and not Reciprocal Rank Fusion:* RRF merges two **rankings** and loses the absolute score, but the aggregation and the hard constraints need a score that says "this dish covers the constraint". Min and max are the simplest operators that make "con" stricter than "y" and "o" looser. Mean-of-two for the hybrid is the baseline anybody can explain; its weight is not tuned on the golden set (declared in the proposal).

*Why the strategy applies to exclusions too:* "sin gluten" through embeddings is a real question (embeddings are weak at negation); measuring it per type is the point of the comparison. When MF-16 adds the food-group table, exclusions move to it and this measurement is the baseline.

### D8. Tests

- `domain/search/`: unit tests for every spec scenario of `menu-search` that is about scoring (strings and numbers, no database). Coverage 100 % (OPS-calidad).
- Use case with fake ports: validation before any call, term embedded once, `lexical` with a failing embedding service, errors without secrets.
- Adapters of `MenuRepository.list`, `RecipeEmbeddingRepository.similarities` and `DishTextSearch` (`infrastructure/`, no coverage threshold): integration tests against a temporary Neon branch with `DATABASE_URL_TEST`, as in `mf-41-search-index` D8; skipped, with a printed notice, when it is not set.
- CLI command: the existing `run-cli` test style (fake container).

## Risks / Trade-offs

- **In the hybrid, a dish with no lexical match can never match a term** (best case: lexical 0, semantic 1, mean 0.5, below 0.75) → intended, and declared; the evaluation shows each strategy separately.
- **The mean-of-two hybrid may be worse than one of its parts** → it is a measured result, not a defect; the evaluation shows each strategy separately and the weight is a named constant.
- **Rescaling per term makes the best dish score 1 even when nothing is relevant** (a term with no good match still has a "most similar" dish) → the hybrid halves its effect with the lexical 0; the semantic-only strategy keeps the flaw and the evaluation will show it on `exclusion` and `attribute`. A similarity floor is a later fix, not tuned now.
- **The golden structures use `term` text from the request, not concepts** → "cenas rápidas" has no mechanism without `totalTimeMin`; that failure is expected and is what MF-16 uses to decide its enrichment.
- **One recipe file with two dish names** → the lexical text carries the menu name, so both names match; the single embedding uses the recipe title. The effect is one dish out of 608.
