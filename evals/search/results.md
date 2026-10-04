# Search evaluation (MF-14)

Written by `pnpm ingest evaluate-search` (spec search-evaluation). Query ids and numbers only: no dish or ingredient text (SEG-datos-nutricionista).

The number of queries behind each mean is in parentheses: per type they are small samples. Ties count by their mean grade (design D3), and hit@5 is the chance of a grade-2 menu in the top five.

## Parameters

| Parameter | Value |
|---|---|
| Embedding model | gemini-embedding-2 |
| Dimensions | 3072 |
| Hybrid weight of the semantic part | 0.5 |
| Match threshold | lexical 0.5, semantic 0.5, hybrid 0.75 |
| Minimum menu score | 0.6 |

## nDCG@5 by query type

| Type | lexical | semantic | hybrid |
|---|---|---|---|
| literal | 0.8509 (n=10) | 0.9000 (n=10) | 0.9000 (n=10) |
| exclusion | 0.5806 (n=7) | 0.3322 (n=7) | 0.6379 (n=7) |
| attribute | 0.0000 (n=9) | 0.4418 (n=9) | 0.0000 (n=9) |
| fuzzy | 0.0424 (n=8) | 0.6755 (n=8) | 0.0424 (n=8) |
| combined | 0.4350 (n=9) | 0.7444 (n=9) | 0.6350 (n=9) |
| overall | 0.3913 (n=43) | 0.6373 (n=43) | 0.4540 (n=43) |

## hit@5 by query type

| Type | lexical | semantic | hybrid |
|---|---|---|---|
| literal | 0.9989 (n=8) | 1.0000 (n=8) | 1.0000 (n=8) |
| exclusion | 0.9499 (n=7) | 0.4226 (n=7) | 0.9480 (n=7) |
| attribute | 0.0000 (n=9) | 0.8889 (n=9) | 0.0000 (n=9) |
| fuzzy | 0.1250 (n=8) | 1.0000 (n=8) | 0.1250 (n=8) |
| combined | 0.6028 (n=9) | 0.8889 (n=9) | 0.6667 (n=9) |
| overall | 0.5138 (n=41) | 0.8526 (n=41) | 0.5277 (n=41) |

## nDCG@5 per query

| Query | Type | lexical | semantic | hybrid |
|---|---|---|---|---|
| A01 | attribute | 0.0000 (empty) | 0.5535 | 0.0000 (empty) |
| A02 | attribute | 0.0000 (empty) | 0.2076 | 0.0000 (empty) |
| A03 | attribute | 0.0000 (empty) | 0.4152 | 0.0000 (empty) |
| A04 | attribute | 0.0000 (empty) | 0.2426 | 0.0000 (empty) |
| A05 | attribute | 0.0000 (empty) | 0.6828 | 0.0000 (empty) |
| A06 | attribute | 0.0000 (empty) | 0.6469 | 0.0000 (empty) |
| A09 | attribute | 0.0000 (empty) | 0.4310 | 0.0000 (empty) |
| A10 | attribute | 0.0000 (empty) | 0.3813 | 0.0000 (empty) |
| A11 | attribute | 0.0000 (empty) | 0.4152 | 0.0000 (empty) |
| C03 | combined | 0.0000 (empty) | 1.0000 | 1.0000 |
| C04 | combined | 0.3392 | 0.3392 | 0.3392 |
| C05 | combined | 0.8571 | 1.0000 | 1.0000 |
| C06 | combined | 0.8333 | 1.0000 | 1.0000 |
| C07 | combined | 0.6250 | 0.6578 | 0.7574 |
| C08 | combined | 0.0000 (empty) | 0.5609 | 0.0000 (empty) |
| C10 | combined | 0.6400 | 0.8422 | 0.8422 |
| C11 | combined | 0.0000 | 0.4538 | 0.2766 |
| C12 | combined | 0.6200 | 0.8459 | 0.5000 |
| E01 | exclusion | 0.7222 | 0.0000 (empty) | 0.7222 |
| E02 | exclusion | 0.5531 | 1.0000 | 1.0000 |
| E03 | exclusion | 0.5714 | 0.6000 | 0.5714 |
| E04 | exclusion | 0.6200 | 0.5559 | 0.5741 |
| E05 | exclusion | 0.4167 | 0.1696 | 0.4167 |
| E06 | exclusion | 0.7227 | 0.0000 (empty) | 0.7227 |
| E07 | exclusion | 0.4583 | 0.0000 (empty) | 0.4583 |
| F01 | fuzzy | 0.0000 (empty) | 0.6918 | 0.0000 (empty) |
| F02 | fuzzy | 0.3392 | 0.9344 | 0.3392 |
| F03 | fuzzy | 0.0000 (empty) | 0.3082 | 0.0000 (empty) |
| F04 | fuzzy | 0.0000 (empty) | 0.6398 | 0.0000 (empty) |
| F05 | fuzzy | 0.0000 (empty) | 0.6992 | 0.0000 (empty) |
| F06 | fuzzy | 0.0000 (empty) | 0.4938 | 0.0000 (empty) |
| F07 | fuzzy | 0.0000 (empty) | 0.7860 | 0.0000 (empty) |
| F08 | fuzzy | 0.0000 (empty) | 0.8510 | 0.0000 (empty) |
| L01 | literal | 0.9348 | 1.0000 | 1.0000 |
| L02 | literal | 1.0000 | 1.0000 | 1.0000 |
| L05 | literal | 0.9687 | 1.0000 | 1.0000 |
| L07 | literal | 1.0000 | 1.0000 | 1.0000 |
| L08 | literal | 0.8095 | 1.0000 | 1.0000 |
| L10 | literal | 1.0000 | 0.0000 | 1.0000 |
| L11 | literal | 0.7963 | 1.0000 | 1.0000 |
| L13 | literal | 1.0000 | 1.0000 | 1.0000 |
| L14 | literal | 0.0000 (empty) | 1.0000 | 0.0000 (empty) |
| L15 | literal | 1.0000 | 1.0000 | 1.0000 |

## Queries without relevant menus

None.
