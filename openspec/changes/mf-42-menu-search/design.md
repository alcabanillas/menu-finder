## Context

See `proposal.md` for the motivation. Constraints that shape the approach:

- **Hexagon (ADR-001):** `domain` imports nothing outside `domain` and `shared`, not even libraries. `cli` imports only `composition/cli-container`, application DTOs and use cases. A port exists only at a real external boundary: here the database and the embedding service. The CLI is the primary adapter; there is no web adapter in this change.
- **Data:** the tables and embeddings of `mf-41-search-index`: 36 menus, 504 meals, 608 menu dishes, 448 recipe rows with one embedding each. The dataset is tiny: every query can score all dishes.
- **Input:** the structure of `evals/decomposer/golden-set.json` (MF-13), whose schema is in `evals/decomposer/golden-set-schema.ts`.

**Status of the decisions below:** they are **proposals for the author's review**. They are not recorded in `context/decisiones.md` until the author confirms them (task 1.1).

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
domain/search/        types, request rules, term scoring (rescale, hybrid), unit and menu scoring,
                      hard constraints, ranking   (pure)
application/
  dto/                search-request (Zod), search-result
  ports/              SearchIndex (EmbeddingsPort comes from mf-41-search-index)
  use-cases/          search-menus
infrastructure/
  postgres/           SearchIndex adapter (the migration goes to `postgres/migrations/002-*.sql` at the repository root)
  genkit/             query task prefix in the EmbeddingsPort adapter
composition/          cli-container wires them; the `SearchIndex` is built only with a database URL
cli/commands/         search
```

`SearchIndex` (read side) has three operations: `catalog()` (menus, meals, dishes with their slot and recipe), `lexicalMatches(term)` (the dishes whose text has every word of the term) and `similarities(vector)` (cosine similarity to every recipe). It is the only way the use case reaches the data, so the domain scores plain numbers.

*Alternative:* one `SearchIndex` that scores dishes inside SQL. Rejected: the hard-constraint counts and the unit scoring would live in SQL and could not be unit-tested without a database.

### D4. Lexical match: Postgres full-text search with the `spanish` configuration and `unaccent`

Proposed. A term is turned into a query with `plainto_tsquery('spanish', unaccent($1))`: it ANDs the words and **discards operators and punctuation**, so a term is never query syntax and the A05 scenarios hold by construction (the value is also a bind parameter). The dish text is `to_tsvector('spanish', unaccent(menu_dish.name)) || recipe.search_vector`, where `recipe.search_vector` is a generated column over title and ingredient names, added by a new migration on top of the schema of `mf-41-search-index`. Tokens are whole words after stemming: "salmón" gives `salmon`, "salmonete" gives `salmonet`, so they differ; "garbanzo" and "garbanzos" give the same stem. With 608 dishes no index is needed.

*Alternatives:* `ILIKE '%term%'` (matches "salmonete" for "salmón", needs escaping of `%` and `_`); `pg_trgm` (fuzzy, not whole-word); matching in application code over the whole catalog (works for the lexical case at this size but does not use the database the product will have, and the comparison is about that stack).

### D5. Term embeddings

The model, dimensions and storage are D5 of `mf-41-search-index`. Terms are embedded with the query task prefix of `gemini-embedding-2`, at most once per distinct term and run.

### D6. Scoring: one dish-score function, fuzzy-logic aggregation

Defined in the spec (`menu-search`). In short: a dish gets a score in [0, 1] for each term; `include` uses it, `exclude` uses one minus it; a `sameDish` group takes the minimum over its members, an `anyOf` group the maximum; a menu takes the best dish per unit and the mean over units; a week-wide exclusion costs `1 / (1 + n)`. The threshold 0.5 decides "matches" for the hard constraints and for `n`.

*Why this and not Reciprocal Rank Fusion:* RRF merges two **rankings** and loses the absolute score, but the aggregation and the hard constraints need a score that says "this dish covers the constraint". Min and max are the simplest operators that make "con" stricter than "y" and "o" looser. Mean-of-two for the hybrid is the baseline anybody can explain; its weight is not tuned on the golden set (declared in the proposal).

*Why the strategy applies to exclusions too:* "sin gluten" through embeddings is a real question (embeddings are weak at negation); measuring it per type is the point of the comparison. When MF-16 adds the food-group table, exclusions move to it and this measurement is the baseline.

### D8. Tests

- `domain/search/`: unit tests for every spec scenario of `menu-search` that is about scoring (strings and numbers, no database). Coverage 100 % (OPS-calidad).
- Use case with fake ports: validation before any call, term embedded once, `lexical` with a failing embedding service, errors without secrets.
- `SearchIndex` adapter (`infrastructure/`, no coverage threshold): integration tests against a temporary Neon branch with `DATABASE_URL_TEST`, as in `mf-41-search-index` D8; skipped, with a printed notice, when it is not set.
- CLI command: the existing `run-cli` test style (fake container).

## Risks / Trade-offs

- **The mean-of-two hybrid may be worse than one of its parts** → it is a measured result, not a defect; the evaluation shows each strategy separately and the weight is a named constant.
- **Rescaling per term makes the best dish score 1 even when nothing is relevant** (a term with no good match still has a "most similar" dish) → the hybrid halves its effect with the lexical 0; the semantic-only strategy keeps the flaw and the evaluation will show it on `exclusion` and `attribute`. A similarity floor is a later fix, not tuned now.
- **The golden structures use `term` text from the request, not concepts** → "cenas rápidas" has no mechanism without `totalTimeMin`; that failure is expected and is what MF-16 uses to decide its enrichment.
- **One recipe file with two dish names** → the lexical text carries the menu name, so both names match; the single embedding uses the recipe title. The effect is one dish out of 608.
