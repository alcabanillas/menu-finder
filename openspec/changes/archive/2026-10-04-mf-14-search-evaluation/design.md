## Context

See `proposal.md` for the motivation. Constraints that shape the approach:

- **Hexagon (ADR-001):** the metrics are pure logic in `domain/search/`; reading the golden sets is an external boundary (files of the repo) behind a port. `cli` imports only `composition/cli-container`, application DTOs and use cases.
- **Golden sets:** the search input is the structure of `evals/decomposer/golden-set.json`; the grades are in `evals/retrieval/golden-set.json` (43 kept queries: literal 10, exclusion 7, attribute 9, fuzzy 8, combined 9; every kept query has grades for the 36 menus). The golden set labels dishes by their menu name.
- **Search:** `searchMenus` of `mf-42-menu-search`; its scoring does not change, its result gains the whole ranking (D3).

## Goals / Non-Goals

**Goals:**
- One table, per query type and strategy, that MF-16 and MF-19 can read as evidence.
- A report that can be committed to a public repo.

**Non-Goals:**
- Tuning anything on the results (the hybrid weight, the threshold).
- The ablations of EVAL-golden-sets (MF-30) and the LLM-as-judge of the explanation.

## Decisions

### D1. Layout and ports

```
domain/search/        nDCG@5, hit@5   (pure)
application/
  dto/                evaluation-report
  ports/              GoldenSetSource
  use-cases/          evaluate-search
infrastructure/
  golden-sets/        GoldenSetSource over evals/
cli/commands/         evaluate-search
```

**Why a new port.** `GoldenSetSource` reads the golden sets, files of `evals/` that no existing port reaches: `DocumentSource` reads the nutritionist's PDFs, and the repositories hold the dataset, not the evaluation inputs. The menus and the search reuse `MenuRepository` and the ports of `searchMenus`.

### D2. Each term embedded once per run (decision R2)

The use case wraps the `EmbeddingsPort` it receives in an in-memory memo keyed by term: a term shared by several queries, or by the semantic and the hybrid run of one query, goes to the API once. It is the same port, so there is no new port and `searchMenus` does not change. The memo lives for one run and nothing is persisted. The author chose not to cache the vectors in the database: the API does not promise identical vectors between runs, so "same report" holds only for the same embeddings, and the report names the model. A flip needs two menus tied to six decimals to move, which is unlikely, and the report is made once and committed.

### D3. Tie-aware metrics (decision R3)

The lexical score is binary per term, so many menus tie (all the menus with a `pollo` dish, or all the menus without the excluded term). Inside a tie the order is the menu number, so a plain nDCG@5 would measure how the menus are numbered. The metrics follow McSherry and Najork (2008): the ranking is split into groups with equal scores at six decimals (the same comparison as `rankMenus`), every position of the top five held by a group gets the mean grade of the group, and hit@5 is the probability that a random order inside the groups puts a grade-2 menu in the top five (`1 − C(g − r, k) / C(g, k)` for the group that crosses the cut, with `g` members, `r` of grade 2 and `k` places). For that the search returns the whole ranking with its scores (`menu-search`, "Top five and ties"). A ranking that is empty because no menu reaches 0.6 scores 0 and is marked empty. That is the case the task review feared would be "menus 1 to 5", which cannot happen because of the minimum.

### D4. Report writing

The use case returns the report as a DTO (ids, types and numbers) plus the per-query detail. The CLI command renders the markdown and writes `evals/search/results.md` through an injected `writeFile`, and prints the detail to the console. The file is written only when the whole run succeeds.

### D7. Evaluation output is committed, aggregated and without text

`evals/search/results.md` is the only artifact of the evaluation, and it is committed: the table is the evidence of pillar 2. It has ids and numbers only (SEG-datos-nutricionista), so the per-query detail needed to understand a miss (which dish ranked) is printed to the console, not saved.

### D8. Tests

- `domain/search/` metrics: unit tests for every scenario of `search-evaluation` about nDCG and hit@5, plus the worked example. Coverage 100 % (OPS-calidad).
- Use case with fake ports: every kept query with all three strategies, inputs validated before any search, each term embedded once per run, no nutritionist text in the report.
- `GoldenSetSource` adapter: temporary files.
- CLI command: the existing `run-cli` test style (fake container).

## Risks / Trade-offs

- **Small samples:** 7 to 10 queries per type → the report prints the count in every cell and the proposal declares it.
- **Hard filters and alternatives are not in the golden set** → declared in the proposal; the table is read as a measurement of the matching strategies, not of the hard filters.
