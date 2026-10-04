## 1. Checks before coding

- [x] 1.1 The author reviews the decisions D4 and D6 of `design.md` (full-text search, scoring) and decides the four open points of the review of the original MF-14, then the artifacts are updated to match; verify: each decision is in the chat, and `design.md` and the spec say the same
  - **Decided on 2026-10-04:** R1 the `tsvector` is computed in the query with a `spanish`-based configuration with `unaccent` (task 1.2 measures the latency); R4 matching threshold 0.5 for `lexical` and `semantic`, 0.75 for `hybrid`; R6 `search` uses `DATABASE_URL_UNPOOLED` and asks for `GEMINI_API_KEY` only with `semantic` and `hybrid`; R7 a stopword-only term scores 0 without failing. Also: read methods added to `MenuRepository` and `RecipeEmbeddingRepository`, new port `DishTextSearch`, migration `003`. The four points follow as they were asked.
  - **R1. How `recipe.search_vector` is built.** D4 calls it a generated column over title and ingredient names, and Postgres rejects that twice: a generated column only takes `IMMUTABLE` functions (`unaccent()` is `STABLE`), and it can only read its own row (the ingredient names are in `recipe_ingredient`). Options: a plain `tsvector` column written by `PostgresRecipeRepository` on every save (touches `mf-41-search-index`), or the `tsvector` computed in the query (cheap with 608 dishes). Either way, a text search configuration copied from `spanish` with `unaccent` in its mapping avoids calling `unaccent()` by hand; task 1.2 should test that configuration. The `unaccent` extension is also missing from the spec.
  - **R4. Hybrid threshold.** A dish "matches" a term at score 0.5 or more (hard constraints and the `n` of week-wide exclusions). The hybrid score is the mean of lexical and semantic, so lexical 0 and semantic 1 give exactly 0.5: the most similar dish of every term always matches, and the hybrid behaves as an OR of the two strategies. Options: `> 0.5`, or another threshold for the hybrid, fixed before seeing any result.
  - **R6. Configuration of `search`.** No requirement says which variables `search` needs or which URL it uses (pooled or direct). It must not demand `GEMINI_API_KEY` with `--strategy lexical`, or it contradicts the requirement "Lexical strategy needs no embeddings". To decide: the URL, and which variables each strategy checks.
  - **R7. Terms made only of stopwords.** `plainto_tsquery('spanish', …)` on "sin", "de" or "no" gives an empty query and a NOTICE; golden query A11 ("no den mucho trabajo") loses its "no" this way. No scenario fixes the result. Proposal: the lexical score is 0 and the search does not fail.
- [x] 1.2 On a temporary Neon branch (created with an expiry), run `CREATE EXTENSION unaccent` and a `to_tsvector('spanish', unaccent('Salmón'))` query; then time the query that builds the `tsvector` of the 608 dishes for 12 terms; verify: both succeed, the latency is written here, and the branch is deleted afterwards
  - **Result (2026-10-04, temporary branch `tmp-mf-42-unaccent-probe`, `EXPLAIN ANALYZE`):** `CREATE EXTENSION unaccent` works, and so does a `spanish`-based configuration with `unaccent` in its mapping (`salmón` and `SALMON` give `salmon`, `salmonete` gives `salmonet`, `garbanzo` and `garbanzos` give `garbanz`, a stopword-only term gives an empty query, a hostile term keeps only its words). Building the `tsvector` of the 608 dishes on the fly took 79 ms for one term on a cold compute and 156 ms for 12 terms in one query (the plan rebuilds it per term and dish, so computing it once with a materialised CTE would cost less). That is acceptable for a CLI search, so the `tsvector` stays computed in the query (D4). The temporary branch is gone: checked on 2026-10-04, it is not in the branch list of the Neon project.

## 2. Domain: scoring (tests first, each seen failing before its code)

- [x] 2.1 Write the tests of the request structure rules of `menu-search` (blank, long and unknown-key terms, 13 constraints, repeated constraint ids, unknown and repeated group ids, polarity rules, zero constraints): the rules in `domain/search/search-request`, the shape and limits against the Zod schema of `use-cases/search-menus`; `application/dto/search-request` holds the input shape `SearchRequestDto`, which the use case validates and turns into the domain request; verify: they fail, then pass once the schema exists
- [x] 2.2 Write the tests of the term scores: semantic rescaling (0.4, 0.6, 0.8 give 0, 0.5, 1), a constant-similarity term (every dish scores 0), the threshold compared at two decimals (0.4999999999999999 matches 0.5), hybrid mean (1 and 0.5 give 0.75), the matching threshold per strategy (0.5, 0.5, 0.75; lexical 0 and semantic 1 do not match in the hybrid); verify: they fail, then pass with `domain/search/term-score`
- [x] 2.3 Write the tests of the unit and menu scores: ungrouped constraints, `sameDish` (same dish and different dishes), exclusion inside a group, `anyOf`, week-wide exclusion (`1/(1+n)`, 0.25 for three), slot, uncovered constraint (0.5), `n` and hard constraints with the hybrid threshold; verify: they fail, then pass with `domain/search/score-menu`
- [x] 2.4 Write the tests of hard constraints: the menus a constraint removes on its own (31 of 36), an empty ranking (36), two hard constraints counted separately and applied together, a hard member in a group, the same 0.75 threshold for a hybrid exclusion alone and in a `sameDish` group (0.3 satisfies both, 0.75 breaks the group); verify: they fail, then pass with `domain/search/hard-constraints`
- [x] 2.5 Write the tests of the ranking: five of twelve, order by score then menu number, tie count, fewer than five, evidence dish per unit, six-decimal comparison; verify: they fail, then pass with `domain/search/rank-menus`
- [x] 2.6 Run `pnpm test:coverage`; verify: `domain/search/` and `use-cases/search-menus` are at 100 %

## 3. Application: use case with fake ports (tests first)

- [x] 3.1 Write the `searchMenus` tests: rejected structure makes no port call, each strategy uses the right port calls, `lexical` works when the embedding fake always fails, a term repeated in two constraints is embedded once, no embeddings gives the "run embed first" error, port failure gives an error with no ranking, the same search twice gives equal results; verify: they fail, then pass with `use-cases/search-menus`

## 4. Infrastructure

- [x] 4.1 Write the migration and adapter tests (`MenuRepository.list`, `RecipeEmbeddingRepository.similarities`, `DishTextSearch`) on the temporary branch: migration `003` applies on top of `001-search-schema.sql` alone (it does not need `002`), whole-word and accent rules (`salmón` / `salmonete` / `SALMON`, `garbanzo` / `garbanzos`), a term of several words matched as a phrase within one field (`tortilla de patatas`, not across two ingredients), a stopword-only term gives no match without failing, a hostile term (`& | ! ' ; --`, emoji, combining accent, 90-character word) neither fails nor changes the data, `similarities` order by cosine, `list` returns 36 menus with 14 meals each; `JsonFileMenuRepository.list` reads back the menus it saved, because it implements the same port; verify: they fail, then pass with `infrastructure/postgres/` (parameterised queries only) and `infrastructure/json-file/`. Tasks 3.1 to 4.2 go in one commit: until the adapters have the new port methods, `tsc` fails
- [x] 4.2 Extend the Genkit `EmbeddingsPort` adapter test with the query task prefix; verify: it fails, then passes

## 5. CLI and composition

- [x] 5.1 Write the CLI tests with a fake container for `search`: extra arguments give the usage and exit 2, a missing file, non-JSON or invalid structure exits 1 naming file and field, a golden-set request file runs with its `id`, `text` and `origin` dropped while an extra key such as `hrad` still exits 1 naming it, an unknown `--strategy` exits 2, `--strategy lexical` works without `GEMINI_API_KEY`, `semantic` and `hybrid` without it exit 1 naming the variable, a valid search prints the top five, the tie count and the removed-menus counts; verify: they fail, then pass with `cli/commands/search` and `run-cli`
- [x] 5.2 Wire the adapters in `composition/cli-container.ts`; verify: `pnpm typecheck`, `pnpm lint` (the boundary rules) and `pnpm test:run` pass

## 6. Run it for real

- [x] 6.1 Run `pnpm ingest migrate`; verify: it applies `003` only
  - **Result (2026-10-04, branch `mf-42-menu-search`):** the output was `Applied 003-dish-text-search.sql` and nothing else.
- [x] 6.2 Run `pnpm ingest search` with the structure of three golden requests (a literal one, a `sameDish` one and one with `hard: true` set by hand, because no golden request has a hard constraint) and `--strategy` each of the three; verify: the output is a top five, a tie count and the removed-menus counts, and a hostile term in the file does not change the database
  - **Result (2026-10-04):** L01 (`garbanzos`), C04 (`salmón` + `verduras` in `sameDish`) and C05 (`arroz` + exclude `carne` in `sameDish`, with `c2` set to `hard: true`), each with the three strategies. All nine runs print a top five, the tie count and the removed-menus line.
    - L01: 23 menus tie at 1 with `lexical`, 2 with `semantic` and `hybrid`.
    - C04: menu 25 ("Pasta integral con verduras y tiras de salmón ahumado") comes first with all three strategies.
    - C05: the hard group removes 1 menu with `lexical` and `hybrid` and 2 with `semantic`.
  - The hostile term `x'); DROP TABLE menu_dish; -- & | !` exits 0 with `lexical` and `hybrid`. The row counts are the same before and after: 608 dishes, 504 meals, 448 recipes, 3451 ingredients and 448 embeddings.

## 7. Close

- [x] 7.1 Update `context/decisiones.md` (D4 and D6 once confirmed in 1.1; IA-criterio-agente if it changes), `context/roadmap.md` (MF-42 done, with the archive link) and `context/tareas/T0-extraccion-previa.md` (the `search` command); verify: `grep` of the task and decision codes and a read of the changed lines
- [x] 7.2 Go through the checklist in `context/safety-first.md` §4 before archiving and record the result; verify: the answers are written at the end of this file
- [ ] 7.3 Once everything else is done and before the archive: point `.env.local` of this worktree to the `production` branch and run `pnpm ingest migrate`; verify: it applies `003` only to `production`. Until then every run of this change goes to the `mf-42-menu-search` branch

## Security checklist (`context/safety-first.md` §4), 2026-10-04

- **Business and security decisions in the backend:** yes. The search runs in the use case; the only entry point is the CLI, run by the owner.
- **New endpoints (auth, permissions, negative tests):** not applicable. There is no endpoint, only the `search` CLI command; the web arrives with MF-22.
- **User from the session:** not applicable, for the same reason.
- **Minimum data returned:** yes. The result has the menu number, the score and, per unit, the day, meal, position and name of the evidence dish; no recipe text or ingredients.
- **No secrets in the diff:** yes. Checked with a `grep` for connection strings with a password and Gemini keys; the only match is the fictitious `postgres://nobody:secret@127.0.0.1:1/none` of a failure test. The CLI output passes through `redactSecrets`.
- **New dependencies:** none. `package.json` only gains the `evals:similarity-floor` script.
- **Parameterised queries:** yes. The three Postgres adapters pass the term and the vector as `$1` and `$2`; no SQL is built by concatenation.
- **Tests with unexpected values:** yes. Zod limits (blank, 101 characters, unknown keys, 13 constraints), and a hostile term in `DishTextSearch` (`& | ! ' ; --`, emoji, combining accent, right-to-left mark, 90-character word), also run for real in task 6.2 with the row counts unchanged. No input reaches an LLM: the terms only go to the embedding model.
- **Sensitive actions logged:** not applicable. A search is a read with no user.
- **Deviations from a MUST rule:** none.
