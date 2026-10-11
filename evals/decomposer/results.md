# Decomposer evaluation (MF-40.3)

Written by `pnpm ingest evaluate-decomposer` (spec decomposer-evaluation). Model names, request ids and numbers only.

One run per model over the 71 requests of `evals/decomposer/golden-set.json`. A constraint is a hit when its term (exact, lowercased), type and polarity match an expected constraint of the same request, one to one. Each cell gives precision (P) and recall (R), then the counts: hits / answered / expected. Small counts are small samples.

## Constraints

| Type | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.8-flash, thinking LOW |
|---|---|---|
| literal | P 0.839 · R 0.839 (26/31/31) | P 0.939 · R 1.000 (31/33/31) |
| exclusion | P 0.947 · R 0.900 (18/19/20) | P 0.950 · R 0.950 (19/20/20) |
| attribute | P 0.333 · R 0.375 (6/18/16) | P 0.353 · R 0.375 (6/17/16) |
| fuzzy | P 0.692 · R 0.545 (18/26/33) | P 0.933 · R 0.848 (28/30/33) |
| overall | P 0.723 · R 0.680 (68/94/100) | P 0.840 · R 0.840 (84/100/100) |

## Hard and slot, over the hits

| Field | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.8-flash, thinking LOW |
|---|---|---|
| hard | 0.971 (66/68) | 0.988 (83/84) |
| slot | 0.985 (67/68) | 0.988 (83/84) |

## Groups

| Group | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.8-flash, thinking LOW |
|---|---|---|
| sameDish | P 0.667 · R 0.800 (4/6/5) | P 0.500 · R 0.800 (4/8/5) |
| anyOf | P – · R 0.000 (0/0/1) | P 1.000 · R 1.000 (1/1/1) |

## Rejections

| Category | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.8-flash, thinking LOW |
|---|---|---|
| gibberish | 3/3 | 3/3 |
| off-topic | 3/3 | 3/3 |
| instruction | 2/2 | 2/2 |
| not-a-search | 2/2 | 2/2 |
| search requests rejected by mistake | 1 (A09) | 0 |

## Invalid answers and failed calls

Both count as an answer with no constraints.

| Outcome | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.8-flash, thinking LOW |
|---|---|---|
| invalid answers | 1 (R01) | 0 |
| failed calls | 0 | 1 (A08) |

## Latency of one decomposition

| Measure | gemini-3.5-flash-lite, thinking MINIMAL | gemini-3.8-flash, thinking LOW |
|---|---|---|
| mean | 743 ms | 2819 ms |
| maximum | 1271 ms | 20012 ms |
