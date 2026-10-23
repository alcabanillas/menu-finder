## MODIFIED Requirements

### Requirement: Text match of a term
For the `lexical` strategy, the score of a dish for a term SHALL be 1 when the words of the term appear as whole words, together and in the same order (as a phrase, with stopwords in between allowed), in one field of the dish, and 0 otherwise. The fields of a dish are the dish name as written in the menu, the recipe title, each ingredient name and, for every constraint except a week-wide exclusion, each food group stored in `ingredient_group` for the dish's ingredients (`BUS-superficie-consulta (c)`); a phrase never runs from one field into another. A week-wide exclusion (`exclude` in no group) SHALL match only the dish name, the recipe title and each ingredient name, never `ingredient_group` (`BUS-superficie-consulta (b)`). The comparison SHALL ignore case and accents (`unaccent`) and SHALL use Spanish word forms (so that "garbanzo" matches "garbanzos" and "verdura" matches "verduras"). A term with no word left after removing stopwords SHALL score 0 for every dish and SHALL NOT make the search fail. A term SHALL never be read as query syntax: operators, quotes, wildcards and SQL fragments in a term are plain text.

#### Scenario: Whole word
- **WHEN** the term is `salmón` and the dishes are `Salmón al horno`, `Ensalada con salmonete` and a dish whose ingredients include `salmón`
- **THEN** the first and third score 1 and the second scores 0

#### Scenario: Case and accents
- **WHEN** the term is `SALMON` and a dish is named `Salmón a la plancha`
- **THEN** the dish scores 1

#### Scenario: Plural
- **WHEN** the term is `garbanzo` and a dish has the ingredient `garbanzos cocidos`
- **THEN** the dish scores 1

#### Scenario: Ingredient food group match for a non-exclusion constraint
- **WHEN** a dish has the ingredient `gamba pelada` classified in the food group `marisco`, and the constraint is `marisco` with polarity `include` (or in a `sameDish` group with `arroz`)
- **THEN** the dish scores 1 for `marisco` in the text match

#### Scenario: Week-wide exclusion ignores ingredient food groups
- **WHEN** a dish has the ingredient `gamba pelada` classified in the food group `marisco` and neither the dish name, the recipe title nor any ingredient name contains the word `marisco`, and the constraint is an ungrouped exclusion `marisco`
- **THEN** the dish scores 0 for the ungrouped exclusion `marisco` and the menu is not removed by it

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
For the `semantic` strategy, the semantic score of a dish for a term SHALL come from the cosine similarity between the embedding of the term and the embedding of the dish's recipe, rescaled for that term so that the least similar dish scores 0 and the most similar scores 1; when every dish has the same similarity the term cannot tell them apart, and every dish scores 0. For any constraint of type `literal` or belonging to a `sameDish` or `anyOf` group, the term score of a dish under the `semantic` strategy SHALL be the maximum of its rescaled semantic score and its text match score (`Math.max(semantic, lexical)`, `BUS-superficie-consulta (d)`), so a dish that matches the term by text or ingredient food group scores 1. For an ungrouped `fuzzy` or `attribute` constraint, the term score of a dish under the `semantic` strategy SHALL be its rescaled semantic score alone. The term SHALL be embedded at most once per run.

#### Scenario: Rescaled scores
- **WHEN** a term of an ungrouped `fuzzy` constraint is embedded and three dishes have similarities 0.4, 0.6 and 0.8, with no text match
- **THEN** their scores are 0, 0.5 and 1

#### Scenario: Max of semantic and lexical for a literal or grouped constraint
- **WHEN** the strategy is `semantic`, the constraint is `literal` (or belongs to a `sameDish` or `anyOf` group), and a dish has a rescaled semantic score of 0.4 and a text match score of 1 (from its text or `ingredient_group`)
- **THEN** the dish's term score for that constraint is 1

#### Scenario: Ungrouped fuzzy constraint keeps its semantic score
- **WHEN** the strategy is `semantic`, the constraint is an ungrouped `fuzzy` constraint `verduras`, and a dish has a rescaled semantic score of 0.6 and a text match score of 1
- **THEN** the dish's term score for that constraint is 0.6, and its literal flag is true

#### Scenario: Same similarity for every dish
- **WHEN** a term of an ungrouped `fuzzy` constraint has the similarity 0.5 with every dish
- **THEN** every dish scores 0 for it

#### Scenario: Term embedded once
- **WHEN** the same term appears in two constraints of one search
- **THEN** the embedding service is called once

#### Scenario: Index not loaded
- **WHEN** the semantic strategy runs and the database has no embeddings
- **THEN** the search returns an error that names the `embed` command and returns no ranking

### Requirement: Evidence of a unit
Each unit of a returned menu SHALL have one evidence item, with the kind of the first step that finds a dish: `literal`, the first dish in menu order that holds the unit word for word ("Literal dish of a unit"); `similar`, the best-scoring dish (the first on a tie) when its score, rounded to two decimals, reaches the matching threshold of the strategy; `none`, no dish. A week-wide exclusion SHALL have the kind `none`. The evidence SHALL NOT change the score of a menu or the ranking.

#### Scenario: A literal dish wins over a more similar one
- **WHEN** the strategy is `semantic`, the constraint is an ungrouped `fuzzy` constraint `verduras`, and a menu has `Crema de calabacín` with semantic score 0.9 (no text match) and `Verduras salteadas` with semantic score 0.8 (with text match)
- **THEN** the menu scores 0.9 and its evidence is `Verduras salteadas` with the kind `literal`

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
- **WHEN** the strategy is `semantic`, the only constraint is an ungrouped `fuzzy` constraint `verduras`, and a menu's literal dish scores 0.8 while its best dish scores 0.9
- **THEN** the menu scores 0.9 and keeps its place in the ranking, and its evidence is the literal dish
