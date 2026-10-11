# Decomposer evaluation (MF-40.3)

Written by `pnpm ingest evaluate-decomposer` (spec decomposer-evaluation). Model names, request ids and numbers only.

One run per model over the 71 requests of `evals/decomposer/golden-set.json`. A constraint is a hit when its term (exact, lowercased), type and polarity match an expected constraint of the same request, one to one. Each cell gives precision (P) and recall (R), then the counts: hits / answered / expected. Small counts are small samples.

## Constraints

| Type | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.8-flash, thinking LOW |
|---|---|---|
| literal | P 1.000 · R 0.871 (27/27/31) | P 1.000 · R 1.000 (31/31/31) |
| exclusion | P 1.000 · R 1.000 (20/20/20) | P 0.952 · R 1.000 (20/21/20) |
| attribute | P 0.316 · R 0.375 (6/19/16) | P 0.375 · R 0.375 (6/16/16) |
| fuzzy | P 0.788 · R 0.788 (26/33/33) | P 0.969 · R 0.939 (31/32/33) |
| overall | P 0.798 · R 0.790 (79/99/100) | P 0.880 · R 0.880 (88/100/100) |

## Hard and slot, over the hits

| Field | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.8-flash, thinking LOW |
|---|---|---|
| hard | 0.987 (78/79) | 1.000 (88/88) |
| slot | 0.962 (76/79) | 0.989 (87/88) |

## Groups

| Group | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.8-flash, thinking LOW |
|---|---|---|
| sameDish | P 0.625 · R 1.000 (5/8/5) | P 0.714 · R 1.000 (5/7/5) |
| anyOf | P 1.000 · R 1.000 (1/1/1) | P – · R 0.000 (0/0/1) |

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
| invalid answers | 0 | 0 |
| failed calls | 0 | 0 |

## Latency of one decomposition

| Measure | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.8-flash, thinking LOW |
|---|---|---|
| mean | 852 ms | 2905 ms |
| maximum | 6468 ms | 12321 ms |
