## MODIFIED Requirements

### Requirement: Menu dataset output
On completion, the system SHALL save the successfully parsed menus in two places, in this order: first `data/menu-platos.json`, then the database (capability `search-index`, requirement "Database content"). The file SHALL be a JSON array of weekly menus, one per parsed menu, in menu-number order. Each weekly menu SHALL have `number` (the folder number, as a number) and `meals`: exactly fourteen meals, one per day (`monday`..`sunday`) and type (`lunch` for the `Comida` row, `dinner` for the `Cena` row), ordered by day and then `lunch` before `dinner`. Each meal SHALL have `day`, `type` and `dishes`; each dish SHALL have `position` (1-based order within the cell), `name`, `hasRecipeMark` and `recipeFile` (the resolved recipe file name without extension, or `null`). The dataset SHALL NOT contain match scores or discarded candidates. Menus that failed SHALL be omitted. When the database save fails after the file was written, the command SHALL say that the file was written and why the database save failed.

#### Scenario: Output shape
- **WHEN** menu folder `Menu 3` is parsed successfully
- **THEN** the dataset has an entry with `number: 3` and fourteen `meals`, each with `day`, `type` and `dishes` of `{ position, name, hasRecipeMark, recipeFile }`

#### Scenario: Dish positions follow cell order
- **WHEN** a `Comida` cell yields `Lentejas estofadas` and then `Merluza al horno`
- **THEN** that lunch meal lists them with `position` `1` and `2` respectively

#### Scenario: Empty Sunday
- **WHEN** the `Domingo` column is empty in both meal rows
- **THEN** the `sunday` `lunch` and `sunday` `dinner` meals are present with `dishes: []`

#### Scenario: No match evidence in the dataset
- **WHEN** a marked dish is resolved with score `1`, and another is unresolved with a discarded candidate
- **THEN** neither dish entry in the dataset contains a score or a candidate; both appear only in the QA report

#### Scenario: Database not updated
- **WHEN** the file is written and the database save fails
- **THEN** the command exits with a non-zero code and says that `data/menu-platos.json` was written and why the database save failed

### Requirement: Local-only CLI command
The menu ingestion SHALL be exposed as a CLI command that runs locally, reads only from the raw menus directory, writes only under `data/` (the menu dataset and the QA report under `data/qa/`) and to the database named by `DATABASE_URL_UNPOOLED`, and makes no other network request. The command SHALL reject unknown arguments with a usage message and a non-zero exit code before reading or writing anything. It SHALL exit with a non-zero code when the raw menus directory does not exist or no menu could be processed, and with a non-zero code when at least one menu failed or could not be saved; it SHALL exit with code zero otherwise, including when some marked dishes are unresolved.
#### Scenario: Successful run
- **WHEN** every menu is parsed without error
- **THEN** the command writes the menu dataset and the QA report under `data/` and exits with code zero

#### Scenario: Unresolved dishes do not fail the run
- **WHEN** every menu is parsed but some marked dishes are unresolved
- **THEN** the command exits with code zero and reports those dishes

#### Scenario: Unknown argument rejected
- **WHEN** the command is invoked with an unrecognised argument
- **THEN** it prints a usage message, exits with a non-zero code, and writes no file

#### Scenario: Raw directory missing
- **WHEN** the raw menus directory does not exist
- **THEN** the command reports the missing directory, exits with a non-zero code, and writes no file

#### Scenario: Partial failure
- **WHEN** one menu fails and the others are parsed
- **THEN** the menu dataset contains the parsed menus, the error is reported, and the command exits with a non-zero code

#### Scenario: Writes confined to data directory
- **WHEN** the command runs
- **THEN** every file it creates or modifies is under `data/`
