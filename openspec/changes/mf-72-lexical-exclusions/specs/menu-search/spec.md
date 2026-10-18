## MODIFIED Requirements

### Requirement: Constraint units and menu score
The constraints SHALL be grouped into units: each `sameDish` group is one unit, each `anyOf` group is one unit, and every other constraint is its own unit. The score of a dish for a constraint SHALL be its term score for an `include` constraint and one minus its term score for an `exclude` constraint; a dish whose meal does not match the constraint's `slot` SHALL score 0 for it. The score of a dish for a `sameDish` unit is the lowest score of its members; for an `anyOf` unit it is the highest. The score of a menu for a unit is the highest score among its dishes. The exception is an `exclude` constraint that is in no group, the week-wide exclusion: it is a filter ("Hard constraints") and SHALL NOT count in the score. The score of a menu is the mean of its other unit scores, and 1 when every unit of the request is a week-wide exclusion.

#### Scenario: Each constraint covered by a different dish
- **WHEN** the constraints are `pollo` and `brócoli` (not grouped), and a menu has one dish with pollo and another with brócoli
- **THEN** both units score 1 and the menu scores 1

#### Scenario: Same dish
- **WHEN** `arroz` and `pollo` are in a `sameDish` group, and a menu has `Arroz con verduras` and `Pollo asado` but no dish with both
- **THEN** the unit scores 0 and the menu scores 0

#### Scenario: Exclusion inside a group
- **WHEN** `arroz` and an exclusion `pescado` are in a `sameDish` group, and the menu's only arroz dish has fish
- **THEN** the unit scores 0

#### Scenario: Alternatives
- **WHEN** `garbanzos` and `lentejas` are in an `anyOf` group and the menu has lentejas and no garbanzos
- **THEN** the unit scores 1

#### Scenario: Week-wide exclusion
- **WHEN** the constraints are `pollo` and the ungrouped exclusion `cerdo`, and a kept menu scores 0.7 for `pollo`
- **THEN** the menu scores 0.7, the score of `pollo` alone

#### Scenario: Only week-wide exclusions
- **WHEN** the only constraint is the ungrouped exclusion `cerdo`
- **THEN** every menu it keeps scores 1, so they tie and are ordered by menu number

#### Scenario: Slot
- **WHEN** a constraint has the slot `dinner` and the only matching dish is at lunch
- **THEN** the constraint scores 0 for that menu

#### Scenario: Uncovered constraint lowers the score
- **WHEN** a menu covers one of two ungrouped constraints
- **THEN** its score is 0.5

### Requirement: Hard constraints
Whether a hard unit is satisfied SHALL be decided with one rule for every unit: a dish matches a term when its term score reaches the matching threshold of the strategy (0.5 for `lexical` and `semantic`, 0.75 for `hybrid`), and an `exclude` constraint is broken by a dish only when that dish matches its term, whether the constraint is alone or in a group. A unit with a `hard` constraint (any member of a group, for a group) SHALL be satisfied by a menu when: for an ungrouped `include` constraint, a dish of the menu matches its term; for a `sameDish` group, one dish of the menu matches the term of every `include` member and does not match the term of any `exclude` member; for an `anyOf` group, a dish of the menu matches the term of any member. The `slot` of a constraint limits the dishes that count for it; in a `sameDish` group the slot describes the dish, so the dish must be in the slot of every member, an `exclude` member included. A week-wide exclusion SHALL always filter, whether `hard` or not and with every strategy: a menu is kept only when no dish of it (of the requested slot, if any) matches its term as the `lexical` strategy matches it ("Text match of a term"), whatever the strategy of the search. A menu that does not satisfy a hard unit or a week-wide exclusion SHALL NOT be ranked. For every hard unit and every week-wide exclusion, the result SHALL report how many of the 36 menus it removes on its own.

#### Scenario: Hard filter removes menus
- **WHEN** a hard constraint is satisfied by 5 of the 36 menus
- **THEN** only those 5 can be in the ranking and the result reports that the constraint removes 31

#### Scenario: Hard filter empties the ranking
- **WHEN** no menu satisfies a hard constraint
- **THEN** the ranking is empty, the result reports that the constraint removes 36 and the search does not fail

#### Scenario: Several hard constraints
- **WHEN** two hard constraints remove 20 and 25 menus on their own
- **THEN** each count is reported separately and the ranking holds only the menus that satisfy both

#### Scenario: Same threshold for an exclusion alone and in a group
- **WHEN** the strategy is `hybrid`, the menu's only arroz dish matches `arroz` and does not contain the word `pescado`, and the exclusion `pescado` is first alone and then in a hard `sameDish` group with `arroz`, with a hybrid score of 0.3 for `pescado`
- **THEN** the menu satisfies the exclusion in both cases: alone, because no dish contains the word; in the group, because 0.3 does not reach 0.75

#### Scenario: Slot of an exclusion in a group
- **WHEN** `arroz` and the exclusion `carne` with slot `dinner` are a hard `sameDish` group ("en la cena, un arroz sin carne")
- **THEN** a menu with an arroz dish without carne at dinner satisfies the group, and a menu whose only arroz dish without carne is at lunch does not

#### Scenario: Exclusion in a group broken by a matching dish
- **WHEN** the strategy is `hybrid`, `arroz` and the exclusion `pescado` are a hard `sameDish` group, and the menu's only arroz dish has a hybrid score of 0.75 for `pescado`
- **THEN** the menu does not satisfy the group

#### Scenario: A soft week-wide exclusion filters
- **WHEN** the ungrouped exclusion `cerdo` has `hard` false and one dish of a menu has the ingredient `magro de cerdo`
- **THEN** that menu is not ranked, and the result reports the menus `cerdo` removes

#### Scenario: A week-wide exclusion is lexical with the semantic strategy
- **WHEN** the strategy is `semantic`, the ungrouped exclusion is `caviar`, and no dish has the word `caviar` in its name, its recipe title or an ingredient, although some dishes have a rescaled semantic score of 1 for it
- **THEN** no menu is removed and the result reports that `caviar` removes 0

#### Scenario: A week-wide exclusion every menu breaks
- **WHEN** the ungrouped exclusion is `huevo` and every menu has a dish with the ingredient `huevo`
- **THEN** the ranking is empty, the result reports that `huevo` removes 36 and the search does not fail

#### Scenario: Slot of a week-wide exclusion
- **WHEN** the ungrouped exclusion `pescado` has the slot `dinner`, and a menu's only dish with the word `pescado` is at lunch
- **THEN** the menu is kept

### Requirement: Search command
`pnpm ingest search <structure.json> [--strategy lexical|semantic|hybrid]` SHALL read the structure from the file, validate it (the file MAY be a request of the decomposer golden set: the command drops its `id`, `text` and `origin` before the search, and passes every other key on), run the search (default strategy `semantic`, the best strategy overall in `evals/search/results.md`, always over `DATABASE_URL_UNPOOLED`; `GEMINI_API_KEY` is required only with `semantic` and `hybrid`) and print the top five, the tie count and the menus each filter (a hard unit or a week-wide exclusion) removes. It SHALL exit with code 1 when the file is missing, is not JSON or is not a valid structure (naming the file and the field), and with code 2 and the usage when the arguments are wrong.

#### Scenario: Run a search
- **WHEN** the command runs on a valid file with `--strategy lexical`
- **THEN** the ranking is printed and the exit code is 0

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
