## Purpose

Scores the 36 weekly menus against a typed structure of constraints (not against text) and returns the five best, together with how many menus each hard constraint removes. It runs with three strategies, lexical, semantic and hybrid, so that they can be compared.

## ADDED Requirements

### Requirement: Request structure
The search SHALL take a structure of constraints, with the shape of the decomposer golden set: each constraint has an `id`, a `type` (`literal`, `exclusion`, `attribute` or `fuzzy`), a `term`, a `polarity` (`include` or `exclude`), `hard` and an optional `slot` (`lunch` or `dinner`); `sameDish` groups list the constraints that one dish must satisfy together ("con"); `anyOf` groups list alternatives, any of which satisfies the condition ("o"). The structure SHALL be validated before any query: unknown keys, an empty or blank `term`, a `term` of more than 100 characters, no constraint, more than 12 constraints, a group with fewer than two constraints or with an unknown id, a constraint in more than one group, an exclusion with polarity `include`, an `anyOf` member with polarity `exclude` and a constraint in both kinds of group SHALL be rejected with an error that names the field. A rejected structure SHALL cause no database or embedding call.

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

#### Scenario: Unknown key
- **WHEN** a constraint has a key that is not in the structure, such as `sql`
- **THEN** the search is rejected naming the key

#### Scenario: Group names an unknown constraint
- **WHEN** a `sameDish` group lists the id `c9` and no constraint has that id
- **THEN** the search is rejected naming `sameDish` and `c9`

#### Scenario: Constraint in two groups
- **WHEN** the same id is in two `sameDish` groups, or in a `sameDish` and an `anyOf` group
- **THEN** the search is rejected naming the id

### Requirement: Text match of a term
For the `lexical` strategy, the score of a dish for a term SHALL be 1 when every word of the term appears as a whole word in the dish text, and 0 otherwise. The dish text is the dish name as written in the menu, the recipe title and the ingredient names. The comparison SHALL ignore case and accents and SHALL use Spanish word forms (so that "garbanzo" matches "garbanzos"). A term SHALL never be read as query syntax: operators, quotes, wildcards and SQL fragments in a term are plain text.

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
- **THEN** the dish scores 0, because `tortilla` and `patatas` are not in the same dish text

#### Scenario: Query syntax in a term
- **WHEN** the term is `pollo & !arroz | '; DROP TABLE menu; --`
- **THEN** the search neither fails nor changes the database, and the words are matched as plain text

#### Scenario: Unicode and very long words
- **WHEN** the term contains an emoji, a combining accent, a right-to-left mark and a 90-character word
- **THEN** the search returns a ranking without an error

### Requirement: Semantic match of a term
For the `semantic` strategy, the score of a dish for a term SHALL come from the cosine similarity between the embedding of the term and the embedding of the dish's recipe, rescaled for that term so that the least similar dish scores 0 and the most similar scores 1. The term SHALL be embedded at most once per run.

#### Scenario: Rescaled scores
- **WHEN** a term is embedded and three dishes have similarities 0.4, 0.6 and 0.8
- **THEN** their scores are 0, 0.5 and 1

#### Scenario: Term embedded once
- **WHEN** the same term appears in two constraints of one search
- **THEN** the embedding service is called once

#### Scenario: Index not loaded
- **WHEN** the semantic strategy runs and the database has no embeddings
- **THEN** the search returns an error that names the `embed` command and returns no ranking

### Requirement: Hybrid strategy
The `hybrid` strategy SHALL score a dish for a term as the mean of its lexical score and its semantic score, with equal weights. The weight SHALL be fixed in the code and SHALL NOT be adjusted from the golden-set results.

#### Scenario: Mean of both
- **WHEN** a dish has lexical score 1 and semantic score 0.5 for a term
- **THEN** its hybrid score is 0.75

### Requirement: Lexical strategy needs no embeddings
The `lexical` strategy SHALL NOT call the embedding service and SHALL work with an empty embedding table.

#### Scenario: Lexical with no embedding service
- **WHEN** the lexical strategy runs and the embedding service would fail on any call
- **THEN** the search returns a ranking

### Requirement: Constraint units and menu score
The constraints SHALL be grouped into units: each `sameDish` group is one unit, each `anyOf` group is one unit, and every other constraint is its own unit. The score of a dish for a constraint SHALL be its term score for an `include` constraint and one minus its term score for an `exclude` constraint; a dish whose meal does not match the constraint's `slot` SHALL score 0 for it. The score of a dish for a `sameDish` unit is the lowest score of its members; for an `anyOf` unit it is the highest. The score of a menu for a unit is the highest score among its dishes. The exception is an `exclude` constraint that is in no group, the week-wide exclusion: its unit score is `1 / (1 + n)`, where `n` is the number of dishes of the menu (of the requested slot, if any) whose term score is 0.5 or more. The score of a menu is the mean of its unit scores.

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
A unit with a `hard` constraint (any member of a group, for a group) SHALL be satisfied by a menu when its score is 0.5 or more and, for a week-wide exclusion, when no dish of the menu reaches the term score of 0.5. A menu that does not satisfy a hard unit SHALL NOT be ranked. For every hard unit, the result SHALL report how many of the 36 menus it removes on its own.

#### Scenario: Hard filter removes menus
- **WHEN** a hard constraint is satisfied by 5 of the 36 menus
- **THEN** only those 5 can be in the ranking and the result reports that the constraint removes 31

#### Scenario: Hard filter empties the ranking
- **WHEN** no menu satisfies a hard constraint
- **THEN** the ranking is empty, the result reports that the constraint removes 36 and the search does not fail

#### Scenario: Several hard constraints
- **WHEN** two hard constraints remove 20 and 25 menus on their own
- **THEN** each count is reported separately and the ranking holds only the menus that satisfy both

### Requirement: Top five and ties
The search SHALL return at most the five best menus, ordered by score from high to low and, for equal scores (compared to six decimals), by menu number from low to high. For every menu returned it SHALL give the menu number, the score and, for each unit, the dish that gave the best score. It SHALL also give the number of ranked menus that tie with the first one.

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
`pnpm ingest search <structure.json> [--strategy lexical|semantic|hybrid]` SHALL read the structure from the file, validate it, run the search (default strategy `hybrid`) and print the top five, the tie count and the menus each hard constraint removes. It SHALL exit with code 1 when the file is missing, is not JSON or is not a valid structure (naming the file and the field), and with code 2 and the usage when the arguments are wrong.

#### Scenario: Run a search
- **WHEN** the command runs on a valid file with `--strategy lexical`
- **THEN** the ranking is printed and the exit code is 0

#### Scenario: Missing file
- **WHEN** the file does not exist
- **THEN** the exit code is 1 and the message names the file

#### Scenario: Unknown strategy
- **WHEN** `--strategy fuzzy-magic` is given
- **THEN** the usage is printed and the exit code is 2
