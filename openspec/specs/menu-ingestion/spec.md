# menu-ingestion Specification

## Purpose

Turns each weekly menu PDF from the nutritionist into structured weekly menus (menu → meals by day and type → ordered dishes), resolving every `*`-marked dish to its recipe file, saving the menus, and reporting, dish by dish, every marked dish that could not be resolved.

## Requirements

### Requirement: Menu discovery
The command SHALL process every folder named `Menu <n>` (where `<n>` is a positive integer) inside the raw menus directory, in ascending numeric order of `<n>`, and SHALL ignore any other entry in that directory.

#### Scenario: Menus processed in numeric order
- **WHEN** the raw directory contains `Menu 10`, `Menu 2` and `Menu 1`
- **THEN** the saved menus are numbers `1`, `2`, `10` in that order

#### Scenario: Non-menu entries ignored
- **WHEN** the raw directory contains `Menu 1`, `Notes` and `Menu x`
- **THEN** only menu `1` is processed and no error is reported for `Notes` or `Menu x`

### Requirement: Menu table location
For each menu, the system SHALL locate in `menu.pdf` the header row whose cells 2 to 8 are the days `Lunes` to `Domingo` (case- and accent-insensitive) and the rows labelled `Comida` and `Cena`. When `menu.pdf` is missing, cannot be read, contains no table, or lacks the header row or either labelled row, the system SHALL record an error for that menu naming the cause and SHALL continue with the remaining menus.

#### Scenario: Header and meal rows found
- **WHEN** a menu table has a header row `Lunes`..`Domingo` and rows labelled `Comida` and `Cena`
- **THEN** the menu is parsed from the `Comida` and `Cena` rows only

#### Scenario: Accent and case differences in labels
- **WHEN** the header reads `MIÉRCOLES` and `SÁBADO` and the meal row reads `comida`
- **THEN** the rows are recognised as the header and the `Comida` row

#### Scenario: Missing menu.pdf
- **WHEN** a `Menu <n>` folder has no `menu.pdf`
- **THEN** an error is recorded for menu `<n>` stating the file is missing, and the other menus are still processed

#### Scenario: Unreadable PDF
- **WHEN** `menu.pdf` cannot be parsed
- **THEN** an error is recorded for that menu with the parse failure reason, and the other menus are still processed

#### Scenario: Missing meal row
- **WHEN** the table has a header row but no row labelled `Cena`
- **THEN** an error is recorded for that menu naming the missing row, and the menu is absent from the saved menus

### Requirement: Cell splitting into dishes
The system SHALL split each `Comida`/`Cena` cell into an ordered list of dishes from its non-empty trimmed lines, where:
- a line ending in `*` closes the accumulated dish as marked (it carries the PDF's recipe mark), with the `*` removed from its name;
- a line starting with an uppercase letter, while unmarked text is accumulated and the previous line does not end in a connector word (`de`, `del`, `con`, `al`, `a`, `en`, `y`, `la`, `el`, `las`, `los`, `sin`), closes the accumulated text as an unmarked dish and starts a new one;
- otherwise the line continues the accumulated dish, joined with a single space;
- unmarked text left at the end of the cell becomes an unmarked dish;
- an unmarked dish that is generic filler (a piece of fruit, or a sugar-free yogurt/kefir, in their known wordings) is dropped.

#### Scenario: Two marked dishes stacked in one cell
- **WHEN** a cell contains `Lentejas estofadas *` and `Merluza al horno *` on separate lines
- **THEN** two dishes are produced, both marked, named `Lentejas estofadas` and `Merluza al horno`

#### Scenario: Wrapped dish name
- **WHEN** a cell contains `Crema de calabaza` and `y zanahoria *` on separate lines
- **THEN** one marked dish named `Crema de calabaza y zanahoria` is produced

#### Scenario: Title Case wrap after a connector
- **WHEN** a cell contains `Ensalada California de` and `Arroz *` on separate lines
- **THEN** one marked dish named `Ensalada California de Arroz` is produced

#### Scenario: Unmarked dish followed by a marked dish
- **WHEN** a cell contains `Tomate y cebolla asada` and `Tortilla francesa *` on separate lines
- **THEN** an unmarked dish `Tomate y cebolla asada` is produced, followed by a marked dish `Tortilla francesa`

#### Scenario: Filler dropped
- **WHEN** a cell contains `Merluza al horno *` and `Una pieza de fruta (no zumo).` on separate lines
- **THEN** only the marked dish `Merluza al horno` is produced

#### Scenario: Empty cell
- **WHEN** a cell is empty or contains only whitespace
- **THEN** no dish is produced for that day and meal

### Requirement: Recipe resolution for marked dishes
For each marked dish, the system SHALL compute a containment score against every candidate recipe file of the same menu folder and SHALL select the candidate with the highest score (the first one wins on ties). The score SHALL be the fraction of the dish's distinct words longer than two letters (lowercased, accent-free, non-alphanumerics as spaces) that also appear in the candidate's normalized file name (hyphens as spaces). Candidates SHALL be the menu folder's recipe PDFs, excluding `menu`, `Lista_de_la_compra`, `valoracion*` and the known breakfast recipes (matched by name prefix). A dish SHALL be resolved only when the best score is `1` (every such word of the dish appears in the file name); unmarked dishes SHALL NOT be matched.

#### Scenario: Marked dish resolved
- **WHEN** a marked dish `Merluza al horno` is compared against a folder with `Merluza-al-horno-con-verduras.pdf`
- **THEN** the dish gets `recipeFile: "Merluza-al-horno-con-verduras"` and the QA report shows score `1.00` for it

#### Scenario: Partial match left unresolved
- **WHEN** a marked dish's best candidate scores `0.6`
- **THEN** the dish gets `recipeFile: null`, and it is reported as unresolved with the discarded candidate and score `0.60`

#### Scenario: Best candidate below threshold
- **WHEN** a marked dish's best candidate scores `0.5`
- **THEN** the dish gets `recipeFile: null`, and it is reported as unresolved with the discarded candidate and score `0.50`

#### Scenario: No recipe files in the folder
- **WHEN** a marked dish belongs to a menu folder with no candidate recipe files
- **THEN** the dish gets `recipeFile: null`, and it is reported as unresolved with no discarded candidate

#### Scenario: Unmarked dish never matched
- **WHEN** an unmarked dish's name exactly matches a recipe file name
- **THEN** the dish gets `recipeFile: null`, has no score in the QA report, and it is not reported as unresolved

#### Scenario: Excluded files are not candidates
- **WHEN** a folder contains `menu.pdf`, `Lista_de_la_compra.pdf`, `valoracion-inicial.pdf` and a breakfast recipe file
- **THEN** none of them is ever selected as a dish's recipe

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

### Requirement: Unresolved marked dishes reporting
Every marked dish left unresolved SHALL be reported individually, both in the console output and in the QA report, with its menu, day, meal, dish name, best discarded candidate (or none) and that candidate's score. Scores SHALL be shown rounded to two decimals. The QA report SHALL show a recipe in its matched-recipe field only for resolved dishes; a discarded candidate SHALL appear only in fields that identify it as discarded.

#### Scenario: Below-threshold candidate not shown as a match
- **WHEN** a marked dish's best candidate `Pollo-al-curry` scores `0.5`
- **THEN** the QA report row for that dish has an empty matched-recipe field and shows `Pollo-al-curry` and `0.50` as the discarded candidate and its score

#### Scenario: Unresolved dish listed in the console
- **WHEN** menu `7`, `tuesday`, `dinner` has an unresolved marked dish `Pollo al curry` whose best candidate scored `0.5`
- **THEN** the console output contains a line identifying menu `7`, `tuesday`, `dinner`, `Pollo al curry`, the discarded candidate and `0.50`

#### Scenario: Resolved dish shows its match
- **WHEN** a marked dish is resolved to `Merluza-al-horno`
- **THEN** the QA report row for that dish shows `Merluza-al-horno` in the matched-recipe field

#### Scenario: Score rounding
- **WHEN** an unresolved dish's discarded candidate scores `2/3`
- **THEN** the QA report shows the discarded score as `0.67`

#### Scenario: No unresolved dishes
- **WHEN** every marked dish is resolved
- **THEN** the console states that there are no unresolved marked dishes

### Requirement: Summary report
The console output SHALL include, across all menus, the number of menus processed without error out of those found, each menu error with its cause, the number of empty slots, the number of slots with two or more dishes, the number of resolved marked dishes, the number of unmarked dishes, the number of unresolved marked dishes and the number of recipe files not claimed by any dish.

#### Scenario: Totals reported
- **WHEN** the command finishes over two menus with one error in the second
- **THEN** the console reports `1/2` menus processed without error and lists the second menu's error with its cause

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
