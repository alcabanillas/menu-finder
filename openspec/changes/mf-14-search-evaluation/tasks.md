## 1. Domain: metrics (tests first, each seen failing before its code)

- [ ] 1.1 Write the nDCG@5 and hit@5 tests: perfect ranking is 1, the worked example is 0.3696, empty ranking is 0 and not a hit, all-zero grades are excluded and listed, fewer than five returned; verify: they fail, then pass with `domain/search/metrics`
- [ ] 1.2 Run `pnpm test:coverage`; verify: the metrics and the new DTOs are at 100 %

## 2. Application: use case with fake ports (tests first)

- [ ] 2.1 Write the `evaluateSearch` tests: every kept query with all three strategies, a withdrawn query ignored, a missing or invalid structure stops with its id, grades missing for a menu stops, each term embedded once per run, the report has ids and numbers and none of the dish or ingredient names of the fake data, the same data gives the same report; verify: they fail, then pass with `use-cases/evaluate-search`

## 3. Infrastructure

- [ ] 3.1 Write the `GoldenSetSource` adapter tests with temporary files: missing file names the file, not-JSON and wrong shape name the first invalid path; verify: they fail, then pass with `infrastructure/golden-sets/`

## 4. CLI and composition

- [ ] 4.1 Write the CLI tests with a fake container for `evaluate-search`: extra arguments give the usage and exit 2 and read nothing, a missing variable exits 1 naming it, a failure exits 1 and writes no report; verify: they fail, then pass with `cli/commands/evaluate-search` and `run-cli`
- [ ] 4.2 Wire the adapters in `composition/cli-container.ts` and add an `evals:search` script if the author wants it (`pnpm ingest evaluate-search` already works); verify: `pnpm typecheck`, `pnpm lint` (the boundary rules) and `pnpm test:run` pass

## 5. Run it for real

- [ ] 5.1 Run `pnpm ingest evaluate-search` and read the table; verify: `evals/search/results.md` exists, has one row per type and one column per strategy with counts, and holds no dish or ingredient names (a test or a `grep` against the loaded names)
- [ ] 5.2 Commit nothing from `data/`; verify: `git status` shows only `evals/search/results.md` and the source files

## 6. Close

- [ ] 6.1 Update `context/decisiones.md` (BUS-superficie-consulta (c) and (d) pointing to the measured result), `context/roadmap.md` (MF-14 done with the archive link; MF-16 with the enrichment the table asks for or skips; MF-19 with the table as input) and `AGENTS.md` (current phase); verify: `grep` of the task and decision codes and a read of the changed lines
- [ ] 6.2 Go through the checklist in `context/safety-first.md` §4 before archiving and record the result; verify: the answers are written at the end of this file
