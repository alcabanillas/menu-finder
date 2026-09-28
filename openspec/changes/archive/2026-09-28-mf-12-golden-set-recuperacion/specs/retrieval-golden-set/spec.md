## Purpose

Builds the graded retrieval golden set that MF-18 uses to compare lexical, semantic and hybrid search per query type: for every query, a relevance grade for each weekly menu, derived from dish-level labels reviewed by the author, with the rules that make those grades reproducible.

## ADDED Requirements

### Requirement: Golden set build
`pnpm evals:golden-set` SHALL read the weekly menus and recipes from `data/`, the query definitions, dish labels and ingredient groups from `evals/retrieval/`, and the author's literal review from `data/golden/`, and SHALL write the golden set and its report. It SHALL take no arguments; with any argument it SHALL print its usage and exit with code `2` without writing. On success it SHALL exit with code `0` and print how many queries were kept and withdrawn per type.

#### Scenario: Successful build
- **WHEN** `pnpm evals:golden-set` runs with valid inputs
- **THEN** `evals/retrieval/golden-set.json` and `data/golden/golden-set-report.md` are written, the per-type counts of kept and withdrawn queries are printed, and the exit code is `0`

#### Scenario: Unexpected argument
- **WHEN** `pnpm evals:golden-set --force` runs
- **THEN** the usage is printed, nothing is written, and the exit code is `2`

### Requirement: Input validation
Every input SHALL be validated before any output is written. A query SHALL have a unique `id`, a `type` in `literal`, `exclusion`, `attribute`, `fuzzy`, `combined`, a non-empty `text`, an `origin` in `llm-blind`, `author`, `known-case`, and a rule of a known kind whose concepts all exist. A labelled or rejected dish SHALL exist in the menus, and a rejected dish SHALL be one that the concept includes before rejections (a label, or a dish with an ingredient of the concept's ingredient group). A literal query SHALL have its section in the literal review. When any input is missing, is not valid JSON or breaks one of these rules, the script SHALL print every error found, each naming the file and the field or entry at fault, SHALL write nothing and SHALL exit with code `1`.

#### Scenario: Unknown concept in a rule
- **WHEN** a query rule refers to the concept `mariscos` and no ingredient group, derived group or dish concept has that name
- **THEN** the error names `queries.json`, the query id and `mariscos`, nothing is written, and the exit code is `1`

#### Scenario: Duplicate query id
- **WHEN** two queries have the id `F01`
- **THEN** the error names `queries.json` and `F01`, nothing is written, and the exit code is `1`

#### Scenario: Labelled dish that does not exist
- **WHEN** `dish-labels.json` lists under `cuchara` a dish that no menu has
- **THEN** the error names `dish-labels.json`, `cuchara` and the dish, nothing is written, and the exit code is `1`

#### Scenario: Several errors at once
- **WHEN** one query has an unknown type and another an unknown concept
- **THEN** both errors are printed, nothing is written, and the exit code is `1`

#### Scenario: Missing menus dataset
- **WHEN** `data/menu-platos.json` does not exist
- **THEN** the error names that file and says to run `pnpm ingest menu` first, nothing is written, and the exit code is `1`

### Requirement: Grades
Every kept query SHALL have exactly one grade per menu in the dataset: `2` highly relevant, `1` partially relevant, `0` not relevant. The same dish SHALL count the same way in every menu where it appears.

#### Scenario: One grade per menu
- **WHEN** the dataset has 36 menus and a query is kept
- **THEN** that query has 36 grades, one per menu number, each `0`, `1` or `2`

### Requirement: Relative grading
Where a rule has no absolute "yes" (exclusions, shares and counts), the grade SHALL be relative to the menus of the dataset. Scores SHALL be ordered from best to worst; with `N` menus, the first threshold is the score at position `max(1, ⌊N/4⌋)` and the second at position `max(1, ⌊N/2⌋)`. A menu SHALL get `2` when its score is at least as good as the first threshold, `1` when at least as good as the second, and `0` otherwise. Ties SHALL get the same grade.

#### Scenario: Lower is better
- **WHEN** four menus break an exclusion in `0`, `1`, `3` and `3` dishes
- **THEN** their grades are `2`, `1`, `0` and `0`

#### Scenario: Ties share the grade
- **WHEN** four menus break an exclusion in `0`, `0`, `0` and `2` dishes
- **THEN** their grades are `2`, `2`, `2` and `0`

### Requirement: Literal queries
A literal query's grades SHALL come from the author's review of its candidates. An accepted candidate SHALL take the grade the author left on it (`2` when the term is in a dish name, `1` when it is only in the ingredients); a rejected candidate and a menu with no candidate SHALL be `0`. A candidate without a mark SHALL count as accepted.

#### Scenario: Rejected substring match
- **WHEN** the query `salmón` has menu 4 as a candidate only through a dish of `salmonete`, and the author rejected it
- **THEN** menu 4 gets `0` for that query

#### Scenario: Ingredient-only match
- **WHEN** the query `garbanzos` has a menu as a candidate only through the ingredient `Harina de garbanzos`, accepted with grade `1`
- **THEN** that menu gets `1` for that query

### Requirement: Literal candidates
`pnpm evals:literal-candidates` SHALL propose, for every literal query, the menus with a dish whose name or ingredients contain every term of the query after removing accents and case, singularizing, and dropping stop words; it SHALL match substrings on purpose, so that the author reviews near matches (`salmonete` for `salmón`). A dish matching only the first term of a multi-word query SHALL be listed as a near miss with grade `0`. It SHALL NOT overwrite an existing review file.

#### Scenario: Near miss listed for review
- **WHEN** the query is `sardinas en lata` and a dish is `Sardinas con salsa de tomate` with no canned ingredient
- **THEN** that dish is listed as a near miss with grade `0` under its menu

#### Scenario: Existing review kept
- **WHEN** `data/golden/literal-candidates.md` already exists
- **THEN** the script prints that the review exists, does not overwrite it, and exits with code `1`

### Requirement: Dish concepts and ingredient groups
A dish SHALL belong to a dish concept when the concept's labels list it and the author has not rejected it for that concept. A dish SHALL belong to an ingredient group when any of its recipe ingredients is listed in that group, or in a group that the derived group includes. A dish SHALL be `pescado_crudo` when the concept's labels list it or one of its ingredients is in the `pescado_curado_ahumado` group, unless the author rejected it for `pescado_crudo`.

#### Scenario: Author rejection wins
- **WHEN** `dish-labels.json` lists `Dorada al horno` under `ligero` and also under `ligero`'s rejected dishes
- **THEN** `Dorada al horno` does not count as `ligero` in any menu

#### Scenario: Ingredient cooked in the dish
- **WHEN** `Macarrones con berenjena y aceitunas` has the ingredient `Anchoas en aceite vegetal` and the author rejected the dish for `pescado_crudo`
- **THEN** the dish does not count for `pescado_crudo`

#### Scenario: Derived group
- **WHEN** `vegetariano` is excluded through the derived group of meat, poultry, fish and seafood, and a dish has the ingredient `Sepia`
- **THEN** the dish breaks the exclusion

### Requirement: Exclusion queries
An exclusion query SHALL score each menu by the number of its dishes that break the exclusion, lower being better, and SHALL grade it with the relative grading.

#### Scenario: No menu is free of the excluded group
- **WHEN** every menu has at least one fish dish and the query is `sin pescado ni marisco`
- **THEN** the menus with the fewest fish and seafood dishes get `2`, and the query is kept

### Requirement: Attribute and fuzzy queries
A share rule SHALL score a menu by the fraction of its dishes, in the rule's meal slot when it has one, that match the concept, excluding dishes whose value is unknown; a menu with no known dish SHALL score `0`. A presence rule SHALL score a menu by the number of matching dishes; a menu with none SHALL get `0`, and the others SHALL get `2` or `1` by the relative grading of that count. A dish is quick when its recipe's total time is at most 20 minutes (strictly under 20 for the `quick-under-20` concept); a dish without recipe SHALL be quick; a recipe with no total time or a total of `0` SHALL be unknown.

#### Scenario: Dish without recipe counts as quick
- **WHEN** a menu's dinners are a dish without recipe and a recipe of 45 minutes
- **THEN** the share of quick dinners for that menu is `0.5`

#### Scenario: Missing total time is left out
- **WHEN** a menu's dinners are a recipe of 10 minutes and a recipe with no total time
- **THEN** the share of quick dinners for that menu is `1`

#### Scenario: Presence of a concept
- **WHEN** four menus have `0`, `1`, `2` and `4` dishes labelled `cuchara`
- **THEN** their grades are `0`, `1`, `1` and `2`

### Requirement: Combined queries
In a combined query, constraints joined by "y" SHALL be satisfied by any dish of the week, each by its own; the menu SHALL get `2` when all are covered, `1` when some are, and `0` when none is. Constraints joined by "con" SHALL be satisfied by one and the same dish; the menu SHALL get `2` when a dish satisfies all of them, `1` when a dish satisfies the main one only, and `0` otherwise. An exclusion bound to one constraint SHALL apply to the dish that satisfies it. An exclusion on the week SHALL keep a fully covered menu at `2` only when its count of breaking dishes gets `2` in the relative grading, and SHALL lower it to `1` otherwise.

#### Scenario: "y" across the week
- **WHEN** the query is `legumbres y pasta` and a menu has a lentil dish on Monday and a pasta dish on Thursday
- **THEN** the menu gets `2`

#### Scenario: "con" in the same dish
- **WHEN** the query is `salmón con verduras` and a menu's only salmon dish has no vegetable ingredient
- **THEN** the menu gets `1`

#### Scenario: Exclusion bound to the dish
- **WHEN** the query is `pasta sin queso` and a menu's only pasta dish has `Queso mozzarella`
- **THEN** the menu gets `1`

#### Scenario: Exclusion on the week
- **WHEN** the query is `pollo y brócoli sin pescado`, a menu covers chicken and broccoli, and its fish dishes are among the most of all menus
- **THEN** the menu gets `1`

### Requirement: Query withdrawal
A query SHALL be withdrawn when no menu gets a grade above `0`, when more than 30 of 36 menus (more than 5/6 of the dataset) get `2`, or when its definition marks it as withdrawn with a reason. A withdrawn query SHALL stay in the golden set with its status and reason and without grades, so that MF-18 skips it and the thesis can report it.

#### Scenario: Saturated query
- **WHEN** 31 of 36 menus get `2` for `pollo y arroz`
- **THEN** the query is withdrawn with the reason `saturated`, and it has no grades

#### Scenario: Query with no relevant menu
- **WHEN** every menu gets `0` for `pescado con arroz`
- **THEN** the query is withdrawn with the reason `no relevant menu`

#### Scenario: Withdrawn by definition
- **WHEN** the definition of `para cenar` marks it withdrawn because every menu has dinners
- **THEN** the query is withdrawn with that reason, and no grade is computed

### Requirement: Golden set file
The script SHALL write `evals/retrieval/golden-set.json` with, per query, its id, type, text, origin, status, withdrawal reason when withdrawn, and the grade per menu number when kept. It SHALL NOT say which dishes a menu has. The same inputs SHALL produce the same bytes: queries in id order and grades in menu order, with no timestamp. Before writing, the script SHALL check that no dish name appears in the file and SHALL fail with code `1` otherwise.

#### Scenario: No menu composition in the committed file
- **WHEN** the golden set is built
- **THEN** no dish name of the menus appears anywhere in `evals/retrieval/golden-set.json`

#### Scenario: Reproducible output
- **WHEN** the script runs twice on the same inputs
- **THEN** both runs write byte-identical golden set files

### Requirement: Golden set report
The script SHALL write `data/golden/golden-set-report.md` with, per kept query, each menu's grade and the dishes that justify it; the withdrawn queries with their reason; the author's rejections per concept; and, per dish concept, the number of labels, the number rejected and the resulting precision, stating that recall is not measured.

#### Scenario: Labeller precision
- **WHEN** a concept has 127 labels and the author rejected 4 of them
- **THEN** the report shows 127 labels, 4 rejected and a precision of 96.9 % for that concept
