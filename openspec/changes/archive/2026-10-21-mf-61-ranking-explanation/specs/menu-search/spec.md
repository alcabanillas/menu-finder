## MODIFIED Requirements

### Requirement: Top five and ties
A menu whose score, rounded to two decimals, is below 0.6 SHALL NOT be ranked: with two units both must count, with three two are enough. The minimum is the same for every strategy and was fixed before any golden-set result. The search SHALL return at most the five best menus, ordered by score from high to low and, for equal scores (compared to six decimals), by menu number from low to high. For every menu returned it SHALL give the menu number, the score and, for each unit, its evidence ("Evidence of a unit"). It SHALL also give the units of the request, in the order of their first constraint, each with its kind (`constraint`, `sameDish` or `anyOf`) and the ids of its constraints, and the evidence of every returned menu SHALL follow that same order, one item per unit. It SHALL also give the number of ranked menus that tie with the first one, and every ranked menu, in the same order, with its menu number and score, so that an evaluation can see the ties that go past the fifth menu.

#### Scenario: Five of many
- **WHEN** 12 menus are ranked
- **THEN** five are returned, the best first

#### Scenario: Ties
- **WHEN** menus 3, 7 and 9 score 1 and menu 5 scores 0.8
- **THEN** the order starts 3, 7, 9, and the tie count is 3

#### Scenario: Minimum menu score
- **WHEN** the strategy is `lexical`, the constraints are `pollo`, `brócoli` and `arroz` (not grouped), menu 1 covers two of them and menu 2 covers one
- **THEN** menu 1 is ranked with score 0.67 and menu 2, with score 0.33, is not

#### Scenario: No menu reaches the minimum
- **WHEN** every menu scores below 0.6
- **THEN** the ranking is empty and the tie count is 0

#### Scenario: Fewer than five
- **WHEN** only two menus satisfy the hard constraints
- **THEN** two are returned

#### Scenario: Evidence
- **WHEN** a menu is returned for the constraint `pollo`
- **THEN** it gives one evidence item for `pollo`, with its dish and its kind as "Evidence of a unit" finds them

#### Scenario: No evidence at score 0
- **WHEN** a menu is returned and every dish of it scores 0 for the constraint `pollo`
- **THEN** it names no dish for that constraint, and the kind is `none`

#### Scenario: Whole ranking
- **WHEN** 12 menus are ranked
- **THEN** five are returned with their evidence, and the whole ranking lists the 12 menu numbers with their scores, in the same order

#### Scenario: Units of the result
- **WHEN** the constraints are `arroz`, the exclusion `marisco` and `pollo`, with `arroz` and `marisco` in a `sameDish` group
- **THEN** the result gives two units, a `sameDish` with the ids of `arroz` and `marisco` and then a `constraint` with the id of `pollo`, and every returned menu has two evidence items in that order

### Requirement: Failures
A failure of the database or of the embedding service SHALL end the search with an error and SHALL NOT return a partial ranking. A failure of the embedding service SHALL be reported as `embedding-failed`, and a failure of the database as `search-failed`, each with its reason. Error messages SHALL NOT contain the connection string or the key.

#### Scenario: Database unreachable
- **WHEN** the database cannot be reached
- **THEN** the search returns a `search-failed` error with no ranking and no credentials in the text

#### Scenario: Embedding service fails
- **WHEN** the strategy is `semantic` and the embedding service fails
- **THEN** the search returns an `embedding-failed` error with its reason, no ranking and no key in the text

#### Scenario: Text match fails with the semantic strategy
- **WHEN** the strategy is `semantic`, the embeddings are read, and the text match of a term fails in the database
- **THEN** the search returns a `search-failed` error with no ranking and no credentials in the text, never a ranking without the literal evidence

### Requirement: Search command
`pnpm ingest search <structure.json> [--strategy lexical|semantic|hybrid]` SHALL read the structure from the file, validate it (the file MAY be a request of the decomposer golden set: the command drops its `id`, `text` and `origin` before the search, and passes every other key on), run the search (default strategy `semantic`, the best strategy overall in `evals/search/results.md`, always over `DATABASE_URL_UNPOOLED`; `GEMINI_API_KEY` is required only with `semantic` and `hybrid`) and print the top five, each evidence dish with its kind (`literal` or `similar`, or "no dish"), the tie count and the menus each filter (a hard unit or a week-wide exclusion) removes. It SHALL exit with code 1 when the file is missing, is not JSON or is not a valid structure (naming the file and the field), and with code 2 and the usage when the arguments are wrong.

#### Scenario: Run a search
- **WHEN** the command runs on a valid file with `--strategy lexical`
- **THEN** the ranking is printed and the exit code is 0

#### Scenario: Evidence printed with its kind
- **WHEN** a returned menu has the `literal` dish `Garbanzos con espinacas` for `c1`, the `similar` dish `Merluza en papillote` for `c2`, and no dish for `c3`
- **THEN** the command prints `c1` with the dish and `literal`, `c2` with the dish and `similar`, and `c3` with "no dish"

#### Scenario: Golden-set request as the file
- **WHEN** the file is a request of the decomposer golden set, with its `id`, `text` and `origin`
- **THEN** the command searches with its constraints and groups, and those three keys do not change the ranking

#### Scenario: Unknown key in a golden-set file
- **WHEN** the file is a golden-set request with an extra key `hrad`
- **THEN** the exit code is 1 and the message names `hrad`

#### Scenario: Lexical without a key
- **WHEN** `GEMINI_API_KEY` is not set and the command runs with `--strategy lexical`
- **THEN** the ranking is printed and the exit code is 0

#### Scenario: Semantic without a key
- **WHEN** `GEMINI_API_KEY` is not set and the command runs with `--strategy semantic` or the default
- **THEN** the exit code is 1 and the message names the variable, never its value

#### Scenario: Missing file
- **WHEN** the file does not exist
- **THEN** the exit code is 1 and the message names the file

#### Scenario: Default strategy
- **WHEN** the command runs on a valid file with no `--strategy`, and `GEMINI_API_KEY` is set
- **THEN** the search uses the `semantic` strategy and the printed ranking names it

#### Scenario: Unknown strategy
- **WHEN** `--strategy fuzzy-magic` is given
- **THEN** the usage is printed and the exit code is 2

#### Scenario: A week-wide exclusion is printed as a filter
- **WHEN** the structure has the soft ungrouped exclusion `cerdo` with id `c2`, which removes 15 menus
- **THEN** the command prints that the filter `c2` removes 15 menus

## ADDED Requirements

### Requirement: Evidence of a unit
Each unit of a returned menu SHALL have one evidence item, with the kind of the first step that finds a dish: `literal`, the first dish in menu order that holds the unit word for word ("Literal dish of a unit"); `similar`, the best-scoring dish (the first on a tie) when its score, rounded to two decimals, reaches the matching threshold of the strategy; `none`, no dish. A week-wide exclusion SHALL have the kind `none`. The evidence SHALL NOT change the score of a menu or the ranking.

#### Scenario: A literal dish wins over a more similar one
- **WHEN** the strategy is `semantic`, the constraint is `garbanzos`, and a menu has `Lentejas estofadas` with score 0.9 and `Garbanzos con espinacas` with score 0.8, and only the second has the word `garbanzos`
- **THEN** the evidence is `Garbanzos con espinacas` with the kind `literal`

#### Scenario: A similar dish
- **WHEN** the strategy is `semantic`, the constraint is `pescado al horno`, no dish of the menu has that phrase, and its best dish `Merluza en papillote` scores 0.7
- **THEN** the evidence is `Merluza en papillote` with the kind `similar`

#### Scenario: A similar dish below the threshold
- **WHEN** the strategy is `semantic`, no dish of the menu has the term, and its best dish scores 0.15
- **THEN** the evidence has no dish and the kind `none`

#### Scenario: Threshold at two decimals
- **WHEN** the strategy is `semantic`, no dish of the menu has the term, and its best dish scores 0.4999999999999999
- **THEN** the score is compared as 0.5 and the evidence is that dish with the kind `similar`

#### Scenario: Lexical strategy
- **WHEN** the strategy is `lexical` and a menu has no dish with the term `salmón`
- **THEN** the evidence has no dish and the kind `none`, and with a dish that has it, that dish with the kind `literal`

#### Scenario: Week-wide exclusion
- **WHEN** the ungrouped exclusion `cerdo` keeps a menu
- **THEN** its evidence has no dish and the kind `none`

#### Scenario: The evidence does not move the ranking
- **WHEN** the strategy is `semantic`, the only constraint is `garbanzos`, and a menu's literal dish scores 0.8 while its best dish scores 0.9
- **THEN** the menu scores 0.9 and keeps its place in the ranking, and its evidence is the literal dish

### Requirement: Literal dish of a unit
A dish SHALL hold an ungrouped `include` constraint word for word when it is in the constraint's `slot` and matches its term as the `lexical` strategy does ("Text match of a term"). For a `sameDish` group it SHALL hold every `include` member that way, be in the slot of every member, and not match any `exclude` member, as "Hard constraints" decides with the strategy of the search. For an `anyOf` group it SHALL hold any `include` member. A unit with no `include` member SHALL have no literal dish.

#### Scenario: Slot of a literal dish
- **WHEN** the constraint `pescado` has the slot `dinner`, and the menu's only dish with the word `pescado` is at lunch
- **THEN** that dish is not the `literal` evidence

#### Scenario: Same dish
- **WHEN** `arroz` and `pollo` are a `sameDish` group, and a menu has `Arroz con pollo`
- **THEN** the evidence is `Arroz con pollo` with the kind `literal`; and with only `Arroz con verduras` and `Pollo asado`, no dish is `literal`

#### Scenario: Same dish with an exclusion
- **WHEN** the strategy is `semantic`, `arroz` and the exclusion `marisco` are a `sameDish` group, and the menu's only dish with the word `arroz` has a semantic score of 0.8 for `marisco`
- **THEN** that dish is not the `literal` evidence, because it matches the exclusion

#### Scenario: Alternatives
- **WHEN** `garbanzos` and `lentejas` are an `anyOf` group and the menu has `Lentejas estofadas` and no dish with `garbanzos`
- **THEN** the evidence is `Lentejas estofadas` with the kind `literal`

### Requirement: Text match with the semantic strategy
With the `semantic` strategy, the search SHALL run the text match of every term it scores with the strategy, once per distinct term, to find the literal dishes, and SHALL NOT call the embedding service for it.

#### Scenario: Text match once per term with the semantic strategy
- **WHEN** the strategy is `semantic` and the term `garbanzos` is in two constraints
- **THEN** the text match runs once for `garbanzos`, and the embedding service is called once for it
