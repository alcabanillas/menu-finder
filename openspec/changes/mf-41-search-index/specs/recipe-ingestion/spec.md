## MODIFIED Requirements

### Requirement: Recipe dataset output
On completion, the system SHALL save the recipes in two places, in this order: first `data/recetas.json`, then the database (capability `search-index`, requirement "Database content"). The file SHALL be a JSON array sorted by file name. Each recipe SHALL have `file` (the file name without extension), `sourceMenu` (the menu number of the kept version), `title`, `times` with `total`, `preparation`, `cooking` and `resting` (minutes or `null`), `ingredients` as a list of `{ name, householdMeasure, quantity, unit, optional }`, and `preparation` as a list of paragraphs. The dataset SHALL NOT contain anomaly counts, discarded versions, nor any text from the page footer or the closing block. When the database save fails after the file was written, the command SHALL say that the file was written and why the database save failed.

#### Scenario: Output shape
- **WHEN** `Tortilla-de-patata` is parsed from menu `4`
- **THEN** the dataset has an entry with `file: "Tortilla-de-patata"`, `sourceMenu: 4`, `title`, `times`, `ingredients` and `preparation`, and no other keys

#### Scenario: Sorted by file name
- **WHEN** the recipes `Tortilla-de-patata` and `Arroz-con-verduras` are parsed
- **THEN** `Arroz-con-verduras` comes first in the dataset

#### Scenario: Database not updated
- **WHEN** the file is written and the database save fails
- **THEN** the command exits with a non-zero code and says that `data/recetas.json` was written and why the database save failed

### Requirement: Local-only recipe command
The recipe ingestion SHALL be exposed as the CLI command `recipes`, which runs locally, reads only from the raw menus directory, writes only under `data/` (the recipe dataset and the QA report under `data/qa/`) and to the database named by `DATABASE_URL_UNPOOLED`, and makes no other network request. Any extra argument SHALL be rejected with a usage message and a non-zero exit code before reading or writing anything. The command SHALL exit with a non-zero code when the raw menus directory does not exist, when no recipe could be parsed (and then SHALL write no dataset), when at least one recipe file failed, or when the recipes could not be saved; it SHALL exit with code zero otherwise, including when anomalies were reported.

#### Scenario: Successful run with anomalies
- **WHEN** every recipe file is parsed and some anomalies are reported
- **THEN** the command writes the recipe dataset and the QA report under `data/` and exits with code zero

#### Scenario: Extra argument rejected
- **WHEN** the command is invoked as `recipes extra`
- **THEN** it prints a usage message, exits with a non-zero code, and writes no file

#### Scenario: Raw directory missing
- **WHEN** the raw menus directory does not exist
- **THEN** the command reports the missing directory, exits with a non-zero code, and writes no file

#### Scenario: No recipe parsed
- **WHEN** the menu folders hold no recipe file that can be parsed
- **THEN** the command reports it, exits with a non-zero code, and writes no dataset

#### Scenario: Partial failure
- **WHEN** one recipe file fails and the others are parsed
- **THEN** the dataset contains the parsed recipes, the error is reported, and the command exits with a non-zero code

#### Scenario: Writes confined to data directory
- **WHEN** the QA directory resolves outside `data/`
- **THEN** the command writes nothing and exits with a non-zero code
