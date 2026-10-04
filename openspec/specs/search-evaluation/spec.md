# search-evaluation Specification

## Purpose
Measures the three search strategies, lexical, semantic and hybrid, against the retrieval golden set, per query type, using the expected structures of the decomposer golden set as input. Its table is the evidence for deciding whether the vector store stays (MF-19) and what the ingestion must enrich (MF-16).

## Requirements

### Requirement: Evaluation inputs
`pnpm ingest evaluate-search` SHALL take, for every query that is `kept` in `evals/retrieval/golden-set.json`, the expected structure of the request with the same id in `evals/decomposer/golden-set.json`, and the grades (0, 1 or 2) of the 36 menus of that query. A kept query with no structure, a structure that is not a valid search structure, or a query without grades for all 36 menus SHALL stop the command with exit code 1 naming the id and the problem. The command SHALL run every strategy on every query.

#### Scenario: Matching ids
- **WHEN** the retrieval golden set keeps the ids `L01` and `A01` and the decomposer golden set has both
- **THEN** both queries are evaluated with all three strategies

#### Scenario: Withdrawn query ignored
- **WHEN** the retrieval golden set has a query with status `withdrawn`
- **THEN** it is not evaluated and not reported as missing

#### Scenario: Structure missing
- **WHEN** a kept query has no structure in the decomposer golden set
- **THEN** the command exits with code 1 and names the id

#### Scenario: Invalid structure
- **WHEN** a golden structure has a blank term
- **THEN** the command exits with code 1, names the id and the field, and writes no report

#### Scenario: Index not loaded
- **WHEN** the database has no menus
- **THEN** the command exits with code 1 and names the `menu` command

### Requirement: Metrics
For every query and strategy the command SHALL compute nDCG@5 with the grade of each menu as its gain and a logarithmic (base 2) discount, over the five menus the search returned, against the ideal order of the 36 grades; a query whose ideal gain is 0 is left out of the means and listed. It SHALL also compute whether the top five hold at least one menu of grade 2 (hit@5), for the queries that have one. A search that returns fewer than five menus is scored on those it returned; an empty ranking scores 0. Both metrics SHALL take ties into account, because the order inside a tie is the menu number and says nothing about the strategy: the command reads the whole ranking of the search, menus whose scores are equal to six decimals form a tied group, every position of the top five held by a group gets the mean grade of the whole group as its gain, and hit@5 is the probability that a random order of the groups puts a menu of grade 2 in the top five.

#### Scenario: Perfect ranking
- **WHEN** the five returned menus are the five best graded, in order
- **THEN** nDCG@5 is 1

#### Scenario: Worked example
- **WHEN** the grades of the returned menus are 0, 2, 0, 1, 0 and the best five grades are 2, 2, 1, 1, 1
- **THEN** nDCG@5 is 0.3696: the discounted gain `2/log2(3) + 1/log2(5)` divided by the ideal `2/log2(2) + 2/log2(3) + 1/log2(4) + 1/log2(5) + 1/log2(6)`, rounded to four decimals

#### Scenario: Tie across the fifth position
- **WHEN** the first menu has grade 2 and scores alone, the next six menus tie with grades 2, 0, 0, 0, 0, 0, and the best five grades are 2, 2, 0, 0, 0
- **THEN** positions 2 to 5 each get a gain of 2/6, and nDCG@5 is 0.8123: `2/log2(2) + (2/6)(1/log2(3) + 1/log2(4) + 1/log2(5) + 1/log2(6))` divided by `2/log2(2) + 2/log2(3)`, rounded to four decimals

#### Scenario: Hit inside a tie
- **WHEN** the ten best menus tie and one of them, the only one of grade 2, is among them
- **THEN** hit@5 is 0.5: one minus the chance `C(9,5)/C(10,5)` that the five places go to the other nine

#### Scenario: Empty ranking
- **WHEN** a hard constraint removes every menu
- **THEN** the query scores nDCG@5 0 and hit@5 false, and the report marks it as empty

#### Scenario: Query without relevant menus
- **WHEN** every grade of a query is 0
- **THEN** it is left out of the means and listed in the report

### Requirement: Report
The command SHALL write `evals/search/results.md`, with the mean nDCG@5 and the mean hit@5 per strategy and per query type (`literal`, `exclusion`, `attribute`, `fuzzy`, `combined`) and overall, the number of queries in each cell, the nDCG@5 of every query, and the parameters of the run (embedding model and dimensionality, hybrid weight, match threshold). The report SHALL contain query ids, types, strategy names and numbers, and SHALL NOT contain dish names, ingredient names or recipe text, because the repository is public. Running the command twice on the same data and with the same term embeddings SHALL give the same report; the embedding service does not promise identical vectors between runs, so the report states the embedding model it was made with.

#### Scenario: Table per type
- **WHEN** the command finishes on queries of the five types
- **THEN** the report has one row per type and one column per strategy, each with its count

#### Scenario: No nutritionist text
- **WHEN** the report is written
- **THEN** no dish name or ingredient name of the loaded dataset appears in it

#### Scenario: Same data, same report
- **WHEN** the command runs twice without reloading the data and the embedding service returns the same vectors
- **THEN** both reports are identical

### Requirement: Cost and failure
Each distinct term SHALL be embedded once per run. The command SHALL NOT generate text and SHALL NOT write to the database. When the database or the embedding service fails it SHALL exit with code 1, SHALL NOT write a partial report, and SHALL NOT print credentials.

#### Scenario: Shared term
- **WHEN** 10 queries use the term `pollo`
- **THEN** it is embedded once in the run

#### Scenario: Service failure
- **WHEN** the embedding service fails during the run
- **THEN** exit code 1, no report is written and the message holds no key

### Requirement: Command usage
`evaluate-search` SHALL take no arguments. Any other argument SHALL print the usage and exit with code 2.

#### Scenario: Extra argument
- **WHEN** `pnpm ingest evaluate-search --strategy lexical` runs
- **THEN** the usage is printed and the exit code is 2
