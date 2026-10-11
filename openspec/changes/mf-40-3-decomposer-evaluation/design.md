## Context

The decomposer of MF-40.2 is a use case, `decomposeRequest`, behind the port `RequestDecomposer`, with a Genkit adapter fixed to `gemini-3.5-flash-lite`. The golden set (`evals/decomposer/golden-set.json`) holds 71 requests: 61 search requests with 100 expected constraints (31 literal, 33 fuzzy, 20 exclusion, 16 attribute), 5 of them with a `sameDish` group and 1 with an `anyOf` group, and 10 rejected requests. `evaluate-search` (MF-14) is the precedent: a use case that reads the golden sets through `GoldenSetSource`, runs, and hands a report DTO to a command that writes `evals/search/results.md`.

## Goals / Non-Goals

**Goals:**
- The scoring rules the author chose, in pure functions with their own tests.
- One run measures both models on the same requests, so the two columns are comparable.

**Non-Goals:**
- Choosing the model: the author decides on the results.
- Tuning the prompt on the golden set (EVAL-golden-sets). A miss is reported, not fixed here.
- Repeated runs to measure the variance of the model: one run per model.

## Decisions

### D1. `GoldenSetSource` grows; no new port

The port already reads `evals/decomposer/golden-set.json` (AGENTS.md, "reuse a port before creating one"). `GoldenSets` gains `requests`: each request with its `id`, its `text` and its expected answer, `{ kind: 'search', structure }` or `{ kind: 'rejection', category }`. `structures` stays as it is for `evaluateSearch`.

*Alternative:* add `text` and an optional `rejection` to `ExpectedStructure`. Rejected because a rejected request would still travel as a structure, which is what the change wants to stop.

### D2. The scoring rules live in the domain

`src/domain/search/decomposition-score.ts`, pure and without libraries (ADR-001):
- `matchConstraints(expected, answered)` pairs each answered constraint with the first unpaired expected constraint of the same `term` (trimmed, lowercased), `type` and `polarity`. It returns the pairs.
- `groupHits(expected, answered, pairs)` counts the answered groups whose members are all paired and whose paired expected ids are exactly one expected group, each expected group used once.

The use case adds them up. Sums over all the requests (micro-average) rather than a mean of per-request scores: a request with one constraint would weigh as much as one with five.

*Alternative:* a best matching (Hungarian algorithm) instead of the first unpaired one. Rejected: two constraints with the same term, type and polarity are interchangeable, so the first one is as good as any.

### D3. The use case reuses `decomposeRequest`

`evaluateDecomposer({ goldenSets, models, now })` calls `decomposeRequest` for each request, so the evaluation measures the same validation the command applies, including the literal-term rule. `models` is a list of `{ model, decomposer }`: one `RequestDecomposer` per model. `now` is a clock in milliseconds, injected so a test can fix the latency.

The answer of `decomposeRequest` becomes one of four outcomes: a structure, a rejection, an invalid answer (`invalid-answer`, `request-too-short`, `request-too-long`) or a failed call (`decomposer-failed`). The last two score as a structure with no constraints, as the spec says.

Calls go one after another, model by model, in the order of the golden set. 142 calls of a second or two each is a few minutes, and sequential calls stay far from any rate limit of the API.

### D4. The adapter takes the model as a parameter

`createGenkitRequestDecomposer(apiKey, model = DECOMPOSER_MODEL, thinkingLevel = 'MINIMAL')`. The command `decompose` keeps calling it with the key only. Each evaluated model runs with the least thinking it accepts: `gemini-3.8-flash` answers `MINIMAL` with HTTP 400, so it runs with `LOW` (found in task 6.1). The report names the level in the column of each model. The list of evaluated models, `gemini-3.5-flash-lite` then `gemini-3.8-flash` (MF-40.2 design D9), is a constant of `cli-container.ts`, the only place that chooses adapters.

### D5. The report

`src/application/dto/decomposer-evaluation.ts` holds the report and the console details. The command renders it as Markdown, with one column per model so the two read side by side:
- constraints: one row per type and one overall, each cell with precision, recall and the three counts;
- `hard` and `slot`: the share of hits that also match;
- groups: one row per kind, with precision, recall and counts;
- rejections: one row per category, hits out of total, plus the search requests rejected by mistake;
- the ids of invalid answers and failed calls;
- latency: mean and maximum in milliseconds.

The report holds no term: the golden set is public, but the rule of `evaluate-search` (ids and numbers only, SEG-datos-nutricionista) is kept so that a report never needs a second look. The terms of the misses go to the console, line by line, for the requests with a miss.

### D6. A failure does not stop the run

Unlike `evaluate-search`, where a failure stops everything, a failed call here is a result of the model: a timeout is part of what is measured. The run stops only before the first call, for an unreadable golden set or a missing key.

## Risks / Trade-offs

- **One run is one sample.** The model is not deterministic, and with MINIMAL thinking a second run can differ by a few constraints. The report says it is one run. Measuring the variance is a non-goal.
- **Small rows.** `anyOf` has 1 expected group, and each rejection category has 2 or 3 requests. The counts are shown in every cell so that nobody reads 100 % on one request as a result.
- **Exact terms are strict.** "cuchara" against "de cuchara" is a miss, though the search may find the same menus (MF-40.2 design D4 measured that cuts change the ranking). This is the rule the author chose; the console lines make these cases visible.
- **The prompt of MF-40.2 is not tuned here.** If a whole type fails, the fix is a new change, and a second run then measures the golden set with knowledge of the first: the presentation declares that.
