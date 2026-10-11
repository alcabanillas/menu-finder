# Decomposer evaluation (MF-40.3)

Written by `pnpm ingest evaluate-decomposer` (spec decomposer-evaluation). Model names, request ids and numbers only.

One run per model over the 71 requests of `evals/decomposer/golden-set.json`. A constraint is a hit when its term (exact, lowercased), type and polarity match an expected constraint of the same request, one to one. Each cell gives precision (P) and recall (R), then the counts: hits / answered / expected. Small counts are small samples.

## Constraints

| Type | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.5-flash-lite, thinking LOW | gemini-3.8-flash, thinking LOW |
|---|---|---|---|
| literal | P 1.000 · R 0.742 (23/23/31) | P 1.000 · R 0.677 (21/21/31) | P 1.000 · R 1.000 (31/31/31) |
| exclusion | P 1.000 · R 1.000 (20/20/20) | P 0.909 · R 1.000 (20/22/20) | P 0.952 · R 1.000 (20/21/20) |
| attribute | P 0.579 · R 0.688 (11/19/16) | P 0.706 · R 0.750 (12/17/16) | P 0.722 · R 0.813 (13/18/16) |
| fuzzy | P 0.722 · R 0.788 (26/36/33) | P 0.615 · R 0.727 (24/39/33) | P 0.935 · R 0.879 (29/31/33) |
| overall | P 0.816 · R 0.800 (80/98/100) | P 0.778 · R 0.770 (77/99/100) | P 0.921 · R 0.930 (93/101/100) |

## Hard and slot, over the hits

| Field | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.5-flash-lite, thinking LOW | gemini-3.8-flash, thinking LOW |
|---|---|---|---|
| hard | 1.000 (80/80) | 1.000 (77/77) | 0.989 (92/93) |
| slot | 0.975 (78/80) | 0.974 (75/77) | 0.989 (92/93) |

## Groups

| Group | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.5-flash-lite, thinking LOW | gemini-3.8-flash, thinking LOW |
|---|---|---|---|
| sameDish | P 0.833 · R 1.000 (5/6/5) | P 0.625 · R 1.000 (5/8/5) | P 0.833 · R 1.000 (5/6/5) |
| anyOf | P 1.000 · R 1.000 (1/1/1) | P 1.000 · R 1.000 (1/1/1) | P 1.000 · R 1.000 (1/1/1) |

## Rejections

| Category | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.5-flash-lite, thinking LOW | gemini-3.8-flash, thinking LOW |
|---|---|---|---|
| gibberish | 3/3 | 3/3 | 3/3 |
| off-topic | 3/3 | 3/3 | 3/3 |
| instruction | 2/2 | 2/2 | 2/2 |
| not-a-search | 2/2 | 2/2 | 2/2 |
| search requests rejected by mistake | 1 (A09) | 1 (A09) | 0 |

## Invalid answers and failed calls

Both count as an answer with no constraints.

| Outcome | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.5-flash-lite, thinking LOW | gemini-3.8-flash, thinking LOW |
|---|---|---|---|
| invalid answers | 0 | 0 | 0 |
| failed calls | 0 | 0 | 0 |

## Latency of one decomposition

| Measure | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.5-flash-lite, thinking LOW | gemini-3.8-flash, thinking LOW |
|---|---|---|---|
| mean | 703 ms | 709 ms | 3036 ms |
| maximum | 1021 ms | 1343 ms | 12663 ms |
