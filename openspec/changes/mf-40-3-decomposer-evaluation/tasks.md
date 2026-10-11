## 1. Setup

- [x] 1.1 Keep working on the MF-40 branch (one PR for all of MF-40), and verify that `pnpm test:run` passes before any change

## 2. Golden set port (design D1)

- [x] 2.1 Write failing tests in `src/infrastructure/golden-sets/file-golden-set-source.test.ts`: `requests` holds every request with its id and text; a search request has the expected structure without `id`, `text` and `origin`; a rejected request has its category; a request without text is a `golden-set-invalid` error (RED)
- [x] 2.2 Add `DecomposerRequest` and `requests` to `src/application/ports/golden-set-source.ts`, and read them in `FileGoldenSetSource` (GREEN). Update the fakes of `GoldenSetSource` in the tests of `evaluate-search`

## 3. Scoring rules (design D2; spec "Constraint hits", "Groups")

- [x] 3.1 Write failing tests in `src/domain/search/decomposition-score.test.ts` for `matchConstraints`: a hit with another case and spaces in the term; same term with another type; "cuchara" against "de cuchara"; one to one, with a term answered twice (RED)
- [x] 3.2 Implement `matchConstraints` (GREEN)
- [x] 3.3 Write failing tests for `groupHits`: a group hit; a group with an unpaired member; a group with an extra member; an expected group counted once (RED)
- [x] 3.4 Implement `groupHits` (GREEN)

## 4. Use case (design D3, D6; spec "Inputs", "Constraint hits", "Hard and slot", "Groups", "Rejections", "Failed answers", "Latency")

- [x] 4.1 Write the DTO `src/application/dto/decomposer-evaluation.ts` (design D5)
- [x] 4.2 Write failing tests in `src/application/use-cases/evaluate-decomposer.test.ts`, with fake decomposers that count their calls and a fake clock, for: every request once per model; an unreadable golden set stops before any call; precision and recall per type with their counts; a missing slot counts as a hit and a slot mismatch; group rows; a rejection hit and another category; a search request rejected by mistake; an invalid answer and a failed call listed and scored as no constraints, without stopping the run; mean and maximum latency; the details of a request with a miss (RED)
- [x] 4.3 Implement `src/application/use-cases/evaluate-decomposer.ts` (GREEN), then refactor with the tests green: exported function first, helpers below in call order (AGENTS.md)

## 5. Adapter and command (design D4, D5; spec "Report")

- [x] 5.1 Write a failing test in `src/infrastructure/genkit/genkit-request-decomposer.test.ts`: the factory takes the model and defaults to `gemini-3.5-flash-lite` (RED), then add the parameter (GREEN)
- [x] 5.2 Write failing tests in `src/cli/run-cli.test.ts`: `evaluate-decomposer` runs with no argument, and one argument prints the usage with exit code 2 (RED), then add it to `CliCommands`, `ARGUMENTS` and `USAGE` (GREEN)
- [x] 5.3 Write failing tests in `src/cli/commands/evaluate-decomposer.test.ts`: the report is written with one column per model and holds no term of the golden set; the misses are printed at the console with their terms; a missing variable and an unreadable golden set exit with 1 and write nothing; a line with a secret comes out redacted (RED)
- [x] 5.4 Implement `src/cli/commands/evaluate-decomposer.ts` (GREEN)
- [x] 5.5 Write a failing test in `src/composition/cli-container.test.ts`: without `GEMINI_API_KEY` the evaluation names the variable and calls nothing (RED). Then wire `evaluateDecomposer` with the two models and `FileGoldenSetSource`, the report path `evals/decomposer/results.md`, and the command in `src/cli/index.ts` (GREEN)

## 6. Real run

- [x] 6.1 Run `pnpm ingest evaluate-decomposer` and commit `evals/decomposer/results.md`. No prompt or label is changed after seeing it (EVAL-golden-sets)

  Results (2026-10-11):
  - First run: `gemini-3.8-flash` answered every call with HTTP 400, "Thinking level MINIMAL is not supported for this model". The adapter now takes the thinking level, and Flash runs with `LOW`, the least it accepts (design D4). That run's Lite column was overall P 0.720 · R 0.670 (67/93/100).
  - Second run, the committed report: Lite (`MINIMAL`) overall P 0.723 · R 0.680 (68/94/100); Flash (`LOW`) P 0.840 · R 0.840 (84/100/100). Both reject the 10 rejected requests with the right category. Lite rejected one search request (A09) and gave one invalid answer (R01); Flash timed out once (A08). Mean latency 743 ms against 2819 ms.
  - Between the two runs, Lite moved by one or two hits per type.
  - Most attribute misses of both models are where the term is cut, not its type: the model answers "para el invierno", "de verano" or "cenar" where the label has "invierno", "verano" or "para cenar". The prompt of MF-40.2 has the example term "para el verano", and `evals/decomposer/labelling-guide.md` rule 3 gives "para el invierno" as an attribute, while the labels keep the short cut. Nothing is changed here: the author decides.

## 7. Documentation

- [x] 7.1 `context/decisiones.md` EVAL-golden-sets: the decomposer is measured with `pnpm ingest evaluate-decomposer`, with the matching rules of the roadmap line of MF-40.3, and the report is `evals/decomposer/results.md`. The figures are not copied there: they live in the report

## 8. Verification

- [x] 8.1 Run `pnpm lint`, `pnpm typecheck` and `pnpm test:run`, and verify everything passes
- [x] 8.2 Run `openspec validate mf-40-3-decomposer-evaluation --strict` and verify it passes
