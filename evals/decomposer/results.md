# Decomposer evaluation (MF-40.3)

Written by `pnpm ingest evaluate-decomposer` (spec decomposer-evaluation). Model names, request ids and numbers only.

One run per model over the 71 requests of `evals/decomposer/golden-set.json`. A constraint is a hit when its term (exact, lowercased), type and polarity match an expected constraint of the same request, one to one. Each cell gives precision (P) and recall (R), then the counts: hits / answered / expected. Small counts are small samples.

## Constraints

| Type | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.5-flash-lite, thinking LOW | gemini-3.8-flash, thinking LOW |
|---|---|---|---|
| literal | P 1.000 · R 0.903 (28/28/31) | P 1.000 · R 0.871 (27/27/31) | P 1.000 · R 0.968 (30/30/31) |
| exclusion | P 0.950 · R 0.950 (19/20/20) | P 0.952 · R 1.000 (20/21/20) | P 0.950 · R 0.950 (19/20/20) |
| attribute | P 0.684 · R 0.813 (13/19/16) | P 0.636 · R 0.875 (14/22/16) | P 0.882 · R 0.938 (15/17/16) |
| fuzzy | P 0.828 · R 0.727 (24/29/33) | P 0.700 · R 0.636 (21/30/33) | P 0.906 · R 0.879 (29/32/33) |
| overall | P 0.875 · R 0.840 (84/96/100) | P 0.820 · R 0.820 (82/100/100) | P 0.939 · R 0.930 (93/99/100) |

## Hard and slot, over the hits

| Field | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.5-flash-lite, thinking LOW | gemini-3.8-flash, thinking LOW |
|---|---|---|---|
| hard | 1.000 (84/84) | 0.976 (80/82) | 1.000 (93/93) |
| slot | 0.964 (81/84) | 0.963 (79/82) | 1.000 (93/93) |

## Groups

| Group | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.5-flash-lite, thinking LOW | gemini-3.8-flash, thinking LOW |
|---|---|---|---|
| sameDish | P 0.714 · R 1.000 (5/7/5) | P 0.833 · R 1.000 (5/6/5) | P 0.667 · R 0.800 (4/6/5) |
| anyOf | P 0.500 · R 1.000 (1/2/1) | P 1.000 · R 1.000 (1/1/1) | P 1.000 · R 1.000 (1/1/1) |

## Rejections

| Category | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.5-flash-lite, thinking LOW | gemini-3.8-flash, thinking LOW |
|---|---|---|---|
| gibberish | 3/3 | 3/3 | 3/3 |
| off-topic | 3/3 | 3/3 | 3/3 |
| instruction | 2/2 | 2/2 | 2/2 |
| not-a-search | 2/2 | 2/2 | 2/2 |
| search requests rejected by mistake | 2 (A09, R05) | 1 (A09) | 0 |

## Invalid answers and failed calls

Both count as an answer with no constraints.

| Outcome | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.5-flash-lite, thinking LOW | gemini-3.8-flash, thinking LOW |
|---|---|---|---|
| invalid answers | 0 | 0 | 0 |
| failed calls | 0 | 0 | 1 (C05) |

## Latency of one decomposition

| Measure | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.5-flash-lite, thinking LOW | gemini-3.8-flash, thinking LOW |
|---|---|---|---|
| mean | 764 ms | 720 ms | 2616 ms |
| 95th percentile | 1032 ms | 924 ms | 6169 ms |
| maximum | 1178 ms | 1141 ms | 20011 ms |
| slowest requests | L01 1178 ms, R07 1147 ms, R04 1055 ms, R01 1032 ms, R03 985 ms | R01 1141 ms, R07 1044 ms, R03 1000 ms, R04 924 ms, C10 920 ms | C05 20011 ms, X08 13889 ms, R05 6926 ms, F01 6169 ms, X07 3849 ms |
