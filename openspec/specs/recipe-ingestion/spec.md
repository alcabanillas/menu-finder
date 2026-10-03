# recipe-ingestion Specification

## Purpose

Turns the nutritionist's recipe PDFs into structured recipes (title, times, ingredients, preparation), one per recipe file, so that menu dishes can point to them, and reports the errors, anomalies and divergent versions found on the way.

## Requirements

### Requirement: Recipe discovery
The command SHALL read the recipe documents of every folder named `Menu <n>` (where `<n>` is a positive integer) inside the raw menus directory, in ascending numeric order of `<n>`. The recipe documents of a folder SHALL be its `.pdf` files except `menu`, `Lista_de_la_compra` and `valoracion*` (case-insensitive); any other entry SHALL be ignored.

#### Scenario: Only recipe PDFs are read
- **WHEN** a `Menu 1` folder contains `menu.pdf`, `Lista_de_la_compra.pdf`, `valoracion-inicial.pdf`, `Tortilla-de-patata.pdf` and `Tortilla-de-patata.pdf.txt`
- **THEN** only `Tortilla-de-patata` is read as a recipe of menu `1`

#### Scenario: Non-menu folders ignored
- **WHEN** the raw directory contains `Menu 1`, `Notes` and `Menu x`
- **THEN** only the recipes of menu `1` are read and no error is reported for `Notes` or `Menu x`

### Requirement: Recipe page parsing
The system SHALL parse the first page of each recipe PDF by the position of its text, with the origin at the bottom-left corner of the page:
- text below `y = 40` is the page footer and SHALL be discarded;
- text above `y = 700` is the title, joined in reading order into one line;
- below the title, text at `x < 290` is the left column and text at `x ≥ 290` is the preparation column;
- in the left column, the `TIEMPOS` header opens the times block and the `INGREDIENTES` header opens the ingredients block, which ends at the line starting with `Los ingredientes con un asterisco`; that line and everything below it in the left column SHALL be discarded;
- the preparation is the text of the preparation column below its `PREPARACIÓN` header (with or without accent).

Text items on the same line (vertical distance under 2 points) SHALL be joined in left-to-right order. When a recipe has no `INGREDIENTES` header, the system SHALL record an error for that file and SHALL continue with the remaining files. When the PDF cannot be read, the system SHALL record an error for that file with the reason and SHALL continue.

#### Scenario: Footer and closing block never reach the recipe
- **WHEN** a recipe page has a footer line below `y = 40` and, in the left column, a closing line `Los ingredientes con un asterisco son opcionales` followed by a contact line
- **THEN** neither the footer, the closing line nor the contact line appears in any field of the recipe

#### Scenario: Title on two lines
- **WHEN** the text above `y = 700` is `Alcachofas rellenas` on one line and `de huevo y gambas` on the next
- **THEN** the recipe title is `Alcachofas rellenas de huevo y gambas`

#### Scenario: Missing ingredients header
- **WHEN** a recipe page has no `INGREDIENTES` header
- **THEN** an error is recorded for that file naming the missing section, no recipe is produced from it, and the other files are still read

#### Scenario: Unreadable PDF
- **WHEN** a recipe file is not a valid PDF
- **THEN** an error is recorded for that file with the reason, and the other files are still read

### Requirement: Times
In the times block, each line SHALL pair a label at `x < 150` with a value at `x ≥ 150`. The labels `Total:`, `Elaboración:`, `Cocción:` and `Espera/reposo:` SHALL map to the total, preparation, cooking and resting times. A value SHALL be in `hh:mm:ss` and SHALL be stored as whole minutes (`hh·60 + mm`, plus the seconds rounded to the nearest minute). A time without a value, or whose value is not `hh:mm:ss`, SHALL be `null`. An unknown label, a value that is not `hh:mm:ss` and a recipe without a total time SHALL each be reported as an anomaly.

#### Scenario: Times in minutes
- **WHEN** the times block reads `Total:` `01:05:00` and `Cocción:` `00:20:40`
- **THEN** the total time is `65`, the cooking time is `21`, and the preparation and resting times are `null`

#### Scenario: Invalid time value
- **WHEN** the times block reads `Total:` `1h 5min`
- **THEN** the total time is `null`, and anomalies are reported for the invalid value and for the missing total time

#### Scenario: Unknown time label
- **WHEN** the times block contains the label `Horneado:` at `x < 150`
- **THEN** an anomaly naming the unknown label is reported, and the four known times are unaffected

### Requirement: Ingredients
In the ingredients block, a line at `x < 150` starting with `- ` SHALL open an ingredient; a line at `x < 150` without the dash SHALL continue the name of the previous ingredient; text at `x ≥ 150` SHALL be the amount of the current ingredient. The ingredient name SHALL drop the dash and the trailing colon, with whitespace collapsed. An amount of the form `[<household measure>] (<number> <unit>) [*...]`, with unit `g`, `ml`, `kg` or `l` and the number using `.` or `,` as decimal separator, SHALL yield the household measure (or `null` when there is none), the quantity, the unit, and `optional: true` when at least one `*` follows. Any other amount SHALL keep its text as the household measure, with `null` quantity and unit, `optional` true when it contains `*`, and SHALL be reported as an anomaly. A name without its trailing colon, an ingredient without amount, text before the first ingredient, an amount before the first ingredient and a recipe with no ingredients SHALL each be reported as an anomaly. Ingredients SHALL keep the order of the page.

#### Scenario: Name wrapped onto a second line
- **WHEN** the ingredients block has `- Aceite de oliva virgen` and, on the next line at `x < 150`, `extra:`, with amount `1 cucharada (15 ml)`
- **THEN** one ingredient is produced: name `Aceite de oliva virgen extra`, household measure `1 cucharada`, quantity `15`, unit `ml`, not optional

#### Scenario: Amount without household measure
- **WHEN** an ingredient `- Arroz:` has amount `(120 g)`
- **THEN** its household measure is `null`, its quantity `120` and its unit `g`

#### Scenario: Optional ingredient
- **WHEN** an ingredient `- Sal:` has amount `al gusto (1 g) *`
- **THEN** its household measure is `al gusto`, its quantity `1`, its unit `g`, and it is optional

#### Scenario: Decimal comma
- **WHEN** an ingredient has amount `(2,5 g)`
- **THEN** its quantity is `2.5`

#### Scenario: Unrecognized amount
- **WHEN** an ingredient `- Pimienta:` has amount `una pizca`
- **THEN** its household measure is `una pizca`, its quantity and unit are `null`, and an anomaly is reported for the unrecognized amount

### Requirement: Preparation
The preparation SHALL be a list of paragraphs in page order. Lines SHALL be joined into one paragraph while the vertical gap between consecutive lines is under 18 points; a larger gap SHALL start a new paragraph. Whitespace SHALL be collapsed. A recipe without a preparation header or with no preparation text SHALL have an empty list and SHALL be reported as an anomaly.

#### Scenario: Paragraph break
- **WHEN** the preparation column has lines 12.5 points apart, then a 25-point gap, then another line
- **THEN** the preparation has two paragraphs, the first joining the close lines with single spaces

#### Scenario: Empty preparation
- **WHEN** a recipe has a `PREPARACIÓN` header and no text below it
- **THEN** its preparation is an empty list and an anomaly is reported for it

### Requirement: Second page
When a recipe PDF has more than one page, text on its second page above the footer SHALL be reported as an anomaly with its beginning; the second page SHALL NOT contribute to the recipe.

#### Scenario: Footer-only second page
- **WHEN** a recipe PDF has a second page with only footer text
- **THEN** no anomaly is reported for it and the recipe is parsed from the first page

#### Scenario: Unexpected text on the second page
- **WHEN** a recipe PDF has a second page with body text
- **THEN** an anomaly is reported for that file with the beginning of that text

### Requirement: One recipe per file
When the same recipe file name is read from several menus, the system SHALL keep only the version from the highest-numbered menu whose file could be parsed. Versions whose file failed SHALL NOT take part. The system SHALL compare each other version with the kept one on title, times, ingredients and preparation, and SHALL report every file with at least one differing version, naming the kept menu, the menus of the differing versions and the fields that differ.

#### Scenario: Highest menu wins
- **WHEN** `Tortilla-de-patata` is read from menus `3` and `12` with different ingredients
- **THEN** only the version from menu `12` is saved, and the report lists `Tortilla-de-patata` with kept menu `12`, differing menu `3` and field `ingredients`

#### Scenario: Identical versions are not divergent
- **WHEN** `Tortilla-de-patata` is read from menus `3` and `12` with identical content
- **THEN** one recipe is saved from menu `12`, the file counts as repeated, and it is not listed as divergent

#### Scenario: Failed version does not win
- **WHEN** `Tortilla-de-patata` from menu `12` has no `INGREDIENTES` header and the one from menu `3` parses
- **THEN** the recipe is saved from menu `3`, and the error for menu `12` is reported

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

### Requirement: Recipe ingestion report
The console output and the QA report SHALL include: the number of recipe files found and parsed, per menu and in total; the number of distinct recipe files; the number of files read from two or more menus; the number of files with divergent versions, overall and per differing field; the number of recipes with a total time and with a preparation (and the number of paragraphs); the number of ingredients, of ingredients with quantity and unit, and of optional ingredients; the number of distinct ingredient names (lowercased); the count of ingredients per unit; every per-file error with its menu, file and cause; and every anomaly with its menu and file. The QA report SHALL also list every divergent file with its kept menu, the differing menus and the differing fields. Statistics about recipe content SHALL be computed over the saved recipes.

#### Scenario: Error listed with its file
- **WHEN** `Menu 5/Crema-de-calabaza` has no `INGREDIENTES` header
- **THEN** the console and the QA report contain a line identifying menu `5`, `Crema-de-calabaza` and the missing section

#### Scenario: Anomaly listed with its file
- **WHEN** `Menu 15/Tostada-integral` has an empty preparation
- **THEN** the console and the QA report contain a line identifying menu `15`, `Tostada-integral` and the empty preparation

#### Scenario: Totals reported
- **WHEN** menu `1` has two recipe files, one of which fails
- **THEN** the report shows `2` files found and `1` parsed for menu `1`

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
