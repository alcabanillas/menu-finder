## Purpose

Scores the 36 weekly menus against a typed structure of constraints (not against text) and returns the five best, together with how many menus each hard constraint removes. It runs with three strategies, lexical, semantic and hybrid, so that they can be compared.

## ADDED Requirements

### Requirement: Request structure
The search SHALL take a structure of constraints, the one the decomposer emits and the decomposer golden set holds as expected output: each constraint has an `id`, a `type` (`literal`, `exclusion`, `attribute` or `fuzzy`), a `term`, a `polarity` (`include` or `exclude`), `hard` and an optional `slot` (`lunch` or `dinner`); `sameDish` groups list the constraints that one dish must satisfy together ("con"); `anyOf` groups list alternatives, any of which satisfies the condition ("o"); both group lists are optional and default to empty. The structure carries nothing else: the metadata of a golden-set request (`id`, `text`, `origin`) is not part of a search. The structure SHALL be validated before any query: unknown keys (any key other than those listed), an empty or blank `term`, a `term` of more than 100 characters, no constraint, more than 12 constraints, two constraints with the same `id`, a group with fewer than two constraints or with an unknown id, a constraint in more than one group, an exclusion with polarity `include`, an `anyOf` member with polarity `exclude` and a constraint in both kinds of group SHALL be rejected with an error that names the field. A rejected structure SHALL cause no database or embedding call.

#### Scenario: Valid structure
- **WHEN** the structure has one literal constraint `pollo` with polarity `include`
- **THEN** it is accepted

#### Scenario: Blank term
- **WHEN** a constraint has the term `"   "`
- **THEN** the search is rejected naming `term` and no query is made

#### Scenario: Term too long
- **WHEN** a term has 101 characters
- **THEN** the search is rejected naming `term`

#### Scenario: Too many constraints
- **WHEN** the structure has 13 constraints
- **THEN** the search is rejected naming `constraints`

#### Scenario: Golden-set metadata
- **WHEN** the structure carries the `id`, `text` and `origin` of a golden-set request
- **THEN** the search is rejected naming those keys

#### Scenario: Unknown key
- **WHEN** a constraint has a key that is not in the structure, such as `sql`
- **THEN** the search is rejected naming the key

#### Scenario: Repeated constraint id
- **WHEN** two constraints have the id `c1`
- **THEN** the search is rejected naming `id` and `c1`

#### Scenario: Group names an unknown constraint
- **WHEN** a `sameDish` group lists the id `c9` and no constraint has that id
- **THEN** the search is rejected naming `sameDish` and `c9`

#### Scenario: Constraint in two groups
- **WHEN** the same id is in two `sameDish` groups, or in a `sameDish` and an `anyOf` group
- **THEN** the search is rejected naming the id

### Requirement: Text match of a term
For the `lexical` strategy, the score of a dish for a term SHALL be 1 when the words of the term appear as whole words, together and in the same order (as a phrase, with stopwords in between allowed), in one field of the dish, and 0 otherwise. The fields of a dish are the dish name as written in the menu, the recipe title and each ingredient name; a phrase never runs from one field into another. The comparison SHALL ignore case and accents (`unaccent`) and SHALL use Spanish word forms (so that "garbanzo" matches "garbanzos"). A term with no word left after removing stopwords SHALL score 0 for every dish and SHALL NOT make the search fail. A term SHALL never be read as query syntax: operators, quotes, wildcards and SQL fragments in a term are plain text.

#### Scenario: Whole word
- **WHEN** the term is `salmón` and the dishes are `Salmón al horno`, `Ensalada con salmonete` and a dish whose ingredients include `salmón`
- **THEN** the first and third score 1 and the second scores 0

#### Scenario: Case and accents
- **WHEN** the term is `SALMON` and a dish is named `Salmón a la plancha`
- **THEN** the dish scores 1

#### Scenario: Plural
- **WHEN** the term is `garbanzo` and a dish has the ingredient `garbanzos cocidos`
- **THEN** the dish scores 1

#### Scenario: Several words
- **WHEN** the term is `tortilla de patatas` and a dish is named `Tortilla de espinacas` with the ingredient `patatas`
- **THEN** the dish scores 0, because `tortilla de patatas` is not a phrase of any field, and a dish named `Tortilla de patatas` scores 1

#### Scenario: Phrase split across two ingredients
- **WHEN** the term is `salmón limón` and a dish has the ingredients `salmón` and `limón`
- **THEN** the dish scores 0, because the phrase is in no single field

#### Scenario: Query syntax in a term
- **WHEN** the term is `pollo & !arroz | '; DROP TABLE menu; --`
- **THEN** the search neither fails nor changes the database, and the words are matched as plain text

#### Scenario: Term made only of stopwords
- **WHEN** the term is `de` or `no` and a menu is scored
- **THEN** every dish scores 0 for it in the lexical part and the search returns a ranking without an error

#### Scenario: Unicode and very long words
- **WHEN** the term contains an emoji, a combining accent, a right-to-left mark and a 90-character word
- **THEN** the search returns a ranking without an error

### Requirement: Semantic match of a term
For the `semantic` strategy, the score of a dish for a term SHALL come from the cosine similarity between the embedding of the term and the embedding of the dish's recipe, rescaled for that term so that the least similar dish scores 0 and the most similar scores 1; when every dish has the same similarity the term cannot tell them apart, and every dish scores 0. The term SHALL be embedded at most once per run.

#### Scenario: Rescaled scores
- **WHEN** a term is embedded and three dishes have similarities 0.4, 0.6 and 0.8
- **THEN** their scores are 0, 0.5 and 1

#### Scenario: Same similarity for every dish
- **WHEN** a term has the similarity 0.5 with every dish
- **THEN** every dish scores 0 for it

#### Scenario: Term embedded once
- **WHEN** the same term appears in two constraints of one search
- **THEN** the embedding service is called once

#### Scenario: Index not loaded
- **WHEN** the semantic strategy runs and the database has no embeddings
- **THEN** the search returns an error that names the `embed` command and returns no ranking

### Requirement: Hybrid strategy
The `hybrid` strategy SHALL score a dish for a term as the mean of its lexical score and its semantic score, with equal weights. The weight SHALL be fixed in the code and SHALL NOT be adjusted from the golden-set results. A dish matches a term in the hybrid strategy at a hybrid score of 0.75 or more, so a dish with lexical score 0 never matches. With every strategy, the term score SHALL be rounded to two decimals before it is compared with the matching threshold, so that a floating-point error does not move the threshold.

#### Scenario: Mean of both
- **WHEN** a dish has lexical score 1 and semantic score 0.5 for a term
- **THEN** its hybrid score is 0.75 and it matches the term

#### Scenario: Threshold at two decimals
- **WHEN** the strategy is `semantic` and the rescaled score of a dish is 0.4999999999999999 because of a floating-point error
- **THEN** the score is compared as 0.5 and the dish matches the term

#### Scenario: No lexical match
- **WHEN** a dish has lexical score 0 and semantic score 1 for a term
- **THEN** its hybrid score is 0.5 and it does not match the term

### Requirement: Lexical strategy needs no embeddings
The `lexical` strategy SHALL NOT call the embedding service and SHALL work with an empty embedding table.

#### Scenario: Lexical with no embedding service
- **WHEN** the lexical strategy runs and the embedding service would fail on any call
- **THEN** the search returns a ranking

### Requirement: Constraint units and menu score
The constraints SHALL be grouped into units: each `sameDish` group is one unit, each `anyOf` group is one unit, and every other constraint is its own unit. The score of a dish for a constraint SHALL be its term score for an `include` constraint and one minus its term score for an `exclude` constraint; a dish whose meal does not match the constraint's `slot` SHALL score 0 for it. The score of a dish for a `sameDish` unit is the lowest score of its members; for an `anyOf` unit it is the highest. The score of a menu for a unit is the highest score among its dishes. The exception is an `exclude` constraint that is in no group, the week-wide exclusion: its unit score is `1 / (1 + n)`, where `n` is the number of dishes of the menu (of the requested slot, if any) whose term score reaches the matching threshold of the strategy (0.5 for `lexical` and `semantic`, 0.75 for `hybrid`). The score of a menu is the mean of its unit scores.

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
- **WHEN** an ungrouped exclusion `cerdo` meets a menu with three dishes that contain it
- **THEN** that unit scores 0.25

#### Scenario: Slot
- **WHEN** a constraint has the slot `dinner` and the only matching dish is at lunch
- **THEN** the constraint scores 0 for that menu

#### Scenario: Uncovered constraint lowers the score
- **WHEN** a menu covers one of two ungrouped constraints
- **THEN** its score is 0.5

### Requirement: Hard constraints
Whether a hard unit is satisfied SHALL be decided with one rule for every unit: a dish matches a term when its term score reaches the matching threshold of the strategy (0.5 for `lexical` and `semantic`, 0.75 for `hybrid`), and an `exclude` constraint is broken by a dish only when that dish matches its term, whether the constraint is alone or in a group. A unit with a `hard` constraint (any member of a group, for a group) SHALL be satisfied by a menu when: for an ungrouped `include` constraint, a dish of the menu matches its term; for a week-wide exclusion, no dish of the menu matches its term; for a `sameDish` group, one dish of the menu matches the term of every `include` member and does not match the term of any `exclude` member; for an `anyOf` group, a dish of the menu matches the term of any member. The `slot` of a constraint limits the dishes that count for it; in a `sameDish` group the slot describes the dish, so the dish must be in the slot of every member, an `exclude` member included. A menu that does not satisfy a hard unit SHALL NOT be ranked. For every hard unit, the result SHALL report how many of the 36 menus it removes on its own.

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
- **WHEN** the strategy is `hybrid`, the menu's only arroz dish matches `arroz` and has a hybrid score of 0.3 for `pescado`, and the hard exclusion `pescado` is first alone and then in a `sameDish` group with `arroz`
- **THEN** the menu satisfies the exclusion in both cases, because 0.3 does not reach 0.75

#### Scenario: Slot of an exclusion in a group
- **WHEN** `arroz` and the exclusion `carne` with slot `dinner` are a hard `sameDish` group ("en la cena, un arroz sin carne")
- **THEN** a menu with an arroz dish without carne at dinner satisfies the group, and a menu whose only arroz dish without carne is at lunch does not

#### Scenario: Exclusion in a group broken by a matching dish
- **WHEN** the strategy is `hybrid`, `arroz` and the exclusion `pescado` are a hard `sameDish` group, and the menu's only arroz dish has a hybrid score of 0.75 for `pescado`
- **THEN** the menu does not satisfy the group

### Requirement: Top five and ties
The search SHALL return at most the five best menus, ordered by score from high to low and, for equal scores (compared to six decimals), by menu number from low to high. For every menu returned it SHALL give the menu number, the score and, for each unit, the dish that gave the best score (the first one in menu order on a tie; none for a week-wide exclusion, which no single dish satisfies). It SHALL also give the number of ranked menus that tie with the first one.

#### Scenario: Five of many
- **WHEN** 12 menus are ranked
- **THEN** five are returned, the best first

#### Scenario: Ties
- **WHEN** menus 3, 7 and 9 score 1 and menu 5 scores 0.5
- **THEN** the order starts 3, 7, 9, and the tie count is 3

#### Scenario: Fewer than five
- **WHEN** only two menus satisfy the hard constraints
- **THEN** two are returned

#### Scenario: Evidence
- **WHEN** a menu is returned for the constraint `pollo`
- **THEN** it names the dish of that menu with the highest score for `pollo`

### Requirement: Search is deterministic and read-only
The same structure, strategy and data SHALL always give the same result, and a search SHALL NOT write to the database.

#### Scenario: Repeated search
- **WHEN** the same search runs twice
- **THEN** both results are identical

### Requirement: Failures
A failure of the database or of the embedding service SHALL end the search with an error and SHALL NOT return a partial ranking. Error messages SHALL NOT contain the connection string or the key.

#### Scenario: Database unreachable
- **WHEN** the database cannot be reached
- **THEN** the search returns an error with no ranking and no credentials in the text

### Requirement: Search command
`pnpm ingest search <structure.json> [--strategy lexical|semantic|hybrid]` SHALL read the structure from the file, validate it (the file MAY be a request of the decomposer golden set: the command drops its `id`, `text` and `origin` before the search, and passes every other key on), run the search (default strategy `hybrid`, always over `DATABASE_URL_UNPOOLED`; `GEMINI_API_KEY` is required only with `semantic` and `hybrid`) and print the top five, the tie count and the menus each hard constraint removes. It SHALL exit with code 1 when the file is missing, is not JSON or is not a valid structure (naming the file and the field), and with code 2 and the usage when the arguments are wrong.

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

#### Scenario: Unknown strategy
- **WHEN** `--strategy fuzzy-magic` is given
- **THEN** the usage is printed and the exit code is 2
