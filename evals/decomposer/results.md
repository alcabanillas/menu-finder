# Decomposer evaluation (MF-40.3)

Written by `pnpm ingest evaluate-decomposer` (spec decomposer-evaluation). Model names, request ids and numbers only.

One run per model over the 71 requests of `evals/decomposer/golden-set.json`. A constraint is a hit when its term (exact, lowercased), type and polarity match an expected constraint of the same request, one to one. Each cell gives precision (P) and recall (R), then the counts: hits / answered / expected. Small counts are small samples.

## Constraints

| Type | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.8-flash, thinking LOW |
|---|---|---|
| literal | P 1.000 · R 0.710 (22/22/31) | P 1.000 · R 0.968 (30/30/31) |
| exclusion | P 1.000 · R 0.950 (19/19/20) | P 0.952 · R 1.000 (20/21/20) |
| attribute | P 0.545 · R 0.750 (12/22/16) | P 0.889 · R 1.000 (16/18/16) |
| fuzzy | P 0.636 · R 0.636 (21/33/33) | P 0.938 · R 0.909 (30/32/33) |
| overall | P 0.771 · R 0.740 (74/96/100) | P 0.950 · R 0.960 (96/101/100) |

## Hard and slot, over the hits

| Field | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.8-flash, thinking LOW |
|---|---|---|
| hard | 1.000 (74/74) | 1.000 (96/96) |
| slot | 0.919 (68/74) | 1.000 (96/96) |

## Groups

| Group | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.8-flash, thinking LOW |
|---|---|---|
| sameDish | P 0.667 · R 0.800 (4/6/5) | P 0.714 · R 1.000 (5/7/5) |
| anyOf | P 1.000 · R 1.000 (1/1/1) | P 1.000 · R 1.000 (1/1/1) |

## Rejections

| Category | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.8-flash, thinking LOW |
|---|---|---|
| gibberish | 3/3 | 3/3 |
| off-topic | 3/3 | 3/3 |
| instruction | 2/2 | 2/2 |
| not-a-search | 2/2 | 2/2 |
| search requests rejected by mistake | 0 | 0 |

## Invalid answers and failed calls

Both count as an answer with no constraints.

| Outcome | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.8-flash, thinking LOW |
|---|---|---|
| invalid answers | 1 (R06) | 0 |
| failed calls | 0 | 0 |

## Latency of one decomposition

| Measure | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.8-flash, thinking LOW |
|---|---|---|
| mean | 728 ms | 2828 ms |
| maximum | 1044 ms | 12720 ms |
