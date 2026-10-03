## Context

See `proposal.md` for the motivation. Constraints that shape the approach:

- **Hexagon (ADR-001):** the metrics are pure logic in `domain/search/`; reading the golden sets is an external boundary (files of the repo) behind a port. `cli` imports only `composition/cli-container`, application DTOs and use cases.
- **Golden sets:** the search input is the structure of `evals/decomposer/golden-set.json`; the grades are in `evals/retrieval/golden-set.json` (43 kept queries: literal 10, exclusion 7, attribute 9, fuzzy 8, combined 9; every kept query has grades for the 36 menus). The golden set labels dishes by their menu name.
- **Search:** `searchMenus` of `mf-42-menu-search`, unchanged.

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
