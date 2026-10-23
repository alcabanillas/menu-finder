# Decomposer evaluation (MF-40.3)

Written by `pnpm ingest evaluate-decomposer` (spec decomposer-evaluation). Model names, request ids and numbers only.

One run per model over the 80 requests of `evals/decomposer/golden-set.json`. A constraint is a hit when its term (exact, lowercased), type and polarity match an expected constraint of the same request, one to one. Each cell gives precision (P) and recall (R), then the counts: hits / answered / expected. Small counts are small samples.

## Constraints

| Type | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.5-flash-lite, thinking LOW | gemini-3.8-flash, thinking LOW |
|---|---|---|---|
| literal | P 0.967 · R 0.853 (29/30/34) | P 1.000 · R 0.941 (32/32/34) | P 1.000 · R 1.000 (34/34/34) |
| exclusion | P 0.950 · R 0.950 (19/20/20) | P 0.952 · R 1.000 (20/21/20) | P 0.952 · R 1.000 (20/21/20) |
| attribute | P 0.550 · R 0.688 (11/20/16) | P 0.684 · R 0.813 (13/19/16) | P 0.882 · R 0.938 (15/17/16) |
| fuzzy | P 0.793 · R 0.676 (23/29/34) | P 0.774 · R 0.706 (24/31/34) | P 0.909 · R 0.882 (30/33/34) |
| overall | P 0.828 · R 0.788 (82/99/104) | P 0.864 · R 0.856 (89/103/104) | P 0.943 · R 0.952 (99/105/104) |

## Hard and slot, over the hits

| Field | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.5-flash-lite, thinking LOW | gemini-3.8-flash, thinking LOW |
|---|---|---|---|
| hard | 0.976 (80/82) | 0.978 (87/89) | 1.000 (99/99) |
| slot | 0.976 (80/82) | 0.966 (86/89) | 1.000 (99/99) |

## Groups

| Group | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.5-flash-lite, thinking LOW | gemini-3.8-flash, thinking LOW |
|---|---|---|---|
| sameDish | P 0.556 · R 1.000 (5/9/5) | P 0.500 · R 0.800 (4/8/5) | P 0.833 · R 1.000 (5/6/5) |
| anyOf | P 1.000 · R 1.000 (1/1/1) | P 1.000 · R 1.000 (1/1/1) | P 1.000 · R 1.000 (1/1/1) |

## Rejections

| Category | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.5-flash-lite, thinking LOW | gemini-3.8-flash, thinking LOW |
|---|---|---|---|
| gibberish | 3/3 | 3/3 | 3/3 |
| off-topic | 3/3 | 3/3 | 3/3 |
| instruction | 2/2 | 2/2 | 2/2 |
| not-a-search | 2/2 | 2/2 | 2/2 |
| out-of-catalog | 5/5 | 5/5 | 5/5 |
| search requests rejected by mistake | 3 (A09, R05, T01) | 1 (A12) | 0 |

## Invalid answers and failed calls

Both count as an answer with no constraints.

| Outcome | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.5-flash-lite, thinking LOW | gemini-3.8-flash, thinking LOW |
|---|---|---|---|
| invalid answers | 0 | 0 | 0 |
| failed calls | 0 | 0 | 0 |

## Latency of one decomposition

| Measure | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.5-flash-lite, thinking LOW | gemini-3.8-flash, thinking LOW |
|---|---|---|---|
| mean | 923 ms | 877 ms | 3118 ms |
| 95th percentile | 1229 ms | 1191 ms | 5301 ms |
| maximum | 1999 ms | 1319 ms | 15838 ms |
| slowest requests | A12 1999 ms, L01 1821 ms, R03 1405 ms, F07 1259 ms, R06 1229 ms | E03 1319 ms, C11 1262 ms, R06 1262 ms, L06 1248 ms, R03 1191 ms | F05 15838 ms, X08 11511 ms, R03 7904 ms, X11 5412 ms, T03 5301 ms |
