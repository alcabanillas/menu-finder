## 0. Decisions before the code

- [x] 0.1 The author decides the two open points of the review of the original MF-14, then the spec and `design.md` are updated to match; verify: each decision is in the chat, and the spec and `design.md` say the same
  - **R2. "Same data, same report" is not guaranteed.** `evaluate-search` embeds every term again on each run, and the Gemini API does not promise identical vectors byte for byte. A tiny difference can flip the order of two menus tied to six decimals, so two runs can give different tables. Options: cache the term embeddings (for example in the database, with their model), or relax the requirement to "same report with the same embeddings".
  - **R3. Ties break by menu number, and that leaks into nDCG.** When no dish matches a query (likely in lexical mode for `attribute` and `exclusion` queries such as A01 "cenas rápidas"), all 36 menus tie and the top five is menus 1 to 5: nDCG then measures how the menus are numbered, not the strategy. These are the types that decide MF-16. Options: when everything ties, report the query as "no signal" (nDCG 0, flagged in the report), or use a tie-aware nDCG.

  - **Decided (2026-10-04):** R2 → relax to "same report with the same embeddings", memo per run (design D2). R3 → tie-aware nDCG@5 and hit@5, with the whole ranking in the search result (design D3, delta of `menu-search`).

## 1. Domain: metrics (tests first, each seen failing before its code)

- [x] 1.1 Write the nDCG@5 and hit@5 tests: perfect ranking is 1, the worked example is 0.3696, the tie across the fifth position is 0.8123, the hit inside a tie is 0.5, empty ranking is 0 and not a hit, all-zero grades are excluded and listed, fewer than five returned; verify: they fail, then pass with `domain/search/ranking-metrics`
- [x] 1.3 Extend the `rankMenus` and `searchMenus` tests with the whole ranking (scenario "Whole ranking" of `menu-search`); verify: they fail, then pass, and the `search` command prints the same as before
- [x] 1.2 Run `pnpm test:coverage`; verify: the metrics and the new DTOs are at 100 %

## 2. Application: use case with fake ports (tests first)

- [x] 2.1 Write the `evaluateSearch` tests: every kept query with all three strategies, a withdrawn query ignored, a missing or invalid structure stops with its id, grades missing for a menu stops, each term embedded once per run, the report has ids and numbers and none of the dish or ingredient names of the fake data, the same data gives the same report; verify: they fail, then pass with `use-cases/evaluate-search`

## 3. Infrastructure

- [x] 3.1 Write the `GoldenSetSource` adapter tests with temporary files: missing file names the file, not-JSON and wrong shape name the first invalid path; verify: they fail, then pass with `infrastructure/golden-sets/`

## 4. CLI and composition

- [x] 4.1 Write the CLI tests with a fake container for `evaluate-search`: extra arguments give the usage and exit 2 and read nothing, a missing variable exits 1 naming it, a failure exits 1 and writes no report; verify: they fail, then pass with `cli/commands/evaluate-search` and `run-cli`
- [x] 4.2 Wire the adapters in `composition/cli-container.ts` and add an `evals:search` script if the author wants it (`pnpm ingest evaluate-search` already works); verify: `pnpm typecheck`, `pnpm lint` (the boundary rules) and `pnpm test:run` pass

## 5. Run it for real

- [x] 5.1 Run `pnpm ingest evaluate-search` and read the table; verify: `evals/search/results.md` exists, has one row per type and one column per strategy with counts, and holds no dish or ingredient names (a test or a `grep` against the loaded names)
- [x] 5.2 Commit nothing from `data/`; verify: `git status` shows only `evals/search/results.md` and the source files

## 6. Close

- [x] 6.1 Update `context/decisiones.md` (BUS-superficie-consulta (c) and (d) pointing to the measured result), `context/roadmap.md` (MF-14 done with the archive link; MF-16 with the enrichment the table asks for or skips; MF-19 with the table as input) and `AGENTS.md` (current phase); verify: `grep` of the task and decision codes and a read of the changed lines
- [x] 6.2 Go through the checklist in `context/safety-first.md` §4 before archiving and record the result; verify: the answers are written at the end of this file
  - **Progress (2026-10-04):** `context/decisiones.md` BUS-superficie-consulta (c) and (d) and `context/roadmap.md` MF-19 point to the measured table. MF-16 carries the measured A03 and A04 scores; whether the season enrichment is skipped is decided in MF-16, not here. The current phase in `AGENTS.md` is left to the author (it is a priority call, not a result of this change). MF-14 ✅ with the archive link is set at archive time.

## Security checklist (`context/safety-first.md` §4), 2026-10-04

- **Business and security decisions in the backend:** yes. The evaluation runs in the use case; the only entry point is the CLI, run by the owner.
- **New endpoints (auth, permissions, negative tests):** not applicable. There is no endpoint, only the `evaluate-search` CLI command.
- **User from the session:** not applicable, for the same reason.
- **Minimum data returned:** yes. The committed report has query ids, types, strategy names and numbers; checked against the 424 dish names and 267 ingredient names of the loaded dataset with 0 matches. The dish names go only to the local console. `SearchResultDto` gains the menu numbers and scores of the whole ranking, no text.
- **No secrets in the diff:** yes. Checked with a `grep` for connection strings with a password and Gemini keys; the only match is the fictitious `postgresql://owner:s3cr3t@ep-x.neon.tech/neondb` of a failure test. The CLI errors pass through `redactSecrets`, with a test.
- **New dependencies:** none. `package.json` and the lockfile are unchanged.
- **Parameterised queries:** yes. No new SQL: the evaluation reuses the adapters of `mf-42-menu-search`.
- **Tests with unexpected values:** yes. Golden sets that are missing, not JSON or with the wrong shape (a grade of 5, a request without id); a blank term and an empty structure stop the run before any search. No input reaches an LLM: the terms only go to the embedding model, each once per run.
- **Sensitive actions logged:** not applicable. The evaluation is a read with no user.
- **Deviations from a MUST rule:** none. One `v8 ignore` marks the unreachable `invalid-request` branch of `evaluate-search` (the structures are validated before the run).
