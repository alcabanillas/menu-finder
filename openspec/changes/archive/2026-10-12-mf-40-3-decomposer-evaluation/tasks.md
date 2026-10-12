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
  - Prompt review (author, 2026-10-11): an LLM of another family reviewed the prompt against the Format and Rules of `labelling-guide.md` only, with no golden set and no result (`evals/decomposer/prompt-review-request.md`). Items 1.1 to 1.7 were applied to the prompt; 2.1 and 2.2 were rejected; 3.1 to 3.3 are wording of the guide (`evals/decomposer/prompt-review-answer.md`). The review did not find the "para el verano" example, which stays. The run before it is kept in `evals/decomposer/results-before-prompt-review.md`.
  - Third run, after the review, the committed `results.md`: Lite overall P 0.798 · R 0.790 (79/99/100); Flash P 0.880 · R 0.880 (88/100/100). Both reject the 10 rejected requests with the right category, reject no search request, and have no invalid answer or failed call. `attribute` does not change (Lite 6/19/16, Flash 6/16/16). Mean latency 852 ms against 2905 ms. This run is not blind: the review was made after seeing the first one, which the presentation declares.
  - Attribute fix (author, 2026-10-12), found by reading the results, so not blind either: the prompt example "para el verano" became "para la primavera" → "primavera", with the rule that an attribute term leaves out the words that only introduce or complete it, and rule 1.5 was narrowed to a dish with one thing or another, because the third run suggested Flash had dropped the `anyOf` of R01 for it.
  - Fourth run, the committed `results.md`: Flash P 0.950 · R 0.960 (96/101/100), attribute 16/18/16, `anyOf` 1/1/1. Lite falls to P 0.771 · R 0.740 (74/96/100): attribute rises to 12/22/16, but it now types concrete ingredients as `fuzzy` (literal recall 0.710) and cuts "de" from fuzzy terms ("de cuchara" → "cuchara"), and it gave one invalid answer (R06). The longer prompt helps Flash and confuses Lite. No more prompt changes are made on this golden set: each one would be fitted to it.
  - Two more prompt examples of "o" (author, 2026-10-12), because the golden set has one `anyOf` group only: "lubina o dorada, sin gluten" makes an `anyOf` group, and "sin nueces o almendras" splits an exclusion and makes none. More "o" requests in the golden set were planned as MF-40.5, and the author dropped it on 2026-10-12, so the `anyOf` row still rests on one group. Lite with `LOW` thinking became a third column, to see whether more thinking helps it.
  - Fifth run, the committed `results.md`: Lite `MINIMAL` P 0.816 · R 0.800 (80/98/100); Lite `LOW` P 0.778 · R 0.770 (77/99/100); Flash `LOW` P 0.921 · R 0.930 (93/101/100). `anyOf` is 1/1/1 for all three. Lite with `LOW` is not better than with `MINIMAL`: it loses literal recall (21/31 against 23/31) and fuzzy precision, with the same latency (709 ms against 703 ms). Flash falls three hits from the fourth run with the same prompt but for the two examples, which is within the variation seen between runs. Both Lite columns rejected A09 by mistake; Flash rejected none. Mean latency: Lite about 0.7 s, Flash 3.0 s, with a maximum of 12.7 s.
  - The author chose `gemini-3.8-flash` with `LOW` for the decomposer (2026-10-12), on its precision and recall. The report then gained the 95th percentile and the five slowest requests of each model (spec "Latency"), to see where the peak of 12.7 s comes from. The author also changed the prompt after a review with another tool: "cenar" and "comer" are meal words, and "para el almuerzo" is a meal that is the whole condition. It was found by reading results, so it is not blind.
  - Sixth run, the committed `results.md`: Flash P 0.939 · R 0.930 (93/99/100), attribute 15/17/16, no search request rejected; Lite `MINIMAL` P 0.875 · R 0.840, Lite `LOW` P 0.820 · R 0.820. Flash latency: mean 2616 ms, 95th percentile 6169 ms, maximum 20011 ms, a timeout on C05 counted as a failed call. Its five slowest requests are C05 (20.0 s), X08 (13.9 s), R05 (6.9 s), F01 (6.2 s) and X07 (3.8 s): the two prompt injections are slow, but so are three search requests, and C05 is a short one. Lite stays under 1.2 s on every request. One run: whether the timeout on C05 repeats is not measured, and it may have been a failure of the API. The author keeps Flash for now (2026-10-12): what the user sees while waiting goes to MF-22, and bounding the worst case to MF-60.

## 7. Documentation

- [x] 7.1 `context/decisiones.md` EVAL-golden-sets: the decomposer is measured with `pnpm ingest evaluate-decomposer`, with the matching rules of the roadmap line of MF-40.3, and the report is `evals/decomposer/results.md`. The figures are not copied there: they live in the report

## 8. Verification

- [x] 8.1 Run `pnpm lint`, `pnpm typecheck` and `pnpm test:run`, and verify everything passes
- [x] 8.2 Run `openspec validate mf-40-3-decomposer-evaluation --strict` and verify it passes
