## Purpose

Turns the nutritionist's shopping list PDFs into structured items, one list per menu, and stores them in the database so that the checklist can work against them. It reports how many pages each list had and what could not be read.

## ADDED Requirements

### Requirement: Shopping list discovery
The command SHALL read the file `Lista_de_la_compra.pdf` (case-insensitive) of every folder named `Menu <n>` (where `<n>` is a positive integer) inside the raw menus directory, in ascending numeric order of `<n>`. Other entries SHALL be ignored. A menu folder with no such file, or with a PDF that cannot be read, SHALL be recorded as a failure with its reason, and the command SHALL continue with the other menus.

#### Scenario: One list per menu folder
- **WHEN** the raw directory contains `Menu 2`, `Menu 10` and `Notes`, and the first two have a `Lista_de_la_compra.pdf`
- **THEN** the lists of menus `2` and `10` are read, in that order, and nothing is reported for `Notes`

#### Scenario: Missing list
- **WHEN** `Menu 3` has no `Lista_de_la_compra.pdf`
- **THEN** a failure naming menu `3` and the missing file is recorded and the other menus are still read

#### Scenario: Unreadable PDF
- **WHEN** a list file is not a valid PDF
- **THEN** a failure with the reason is recorded for that menu and the other menus are still read

### Requirement: Page reading
The page has two fixed columns. The system SHALL read every page of the list PDF following each column across the pages (the left column of every page in page order, then the right column of every page), so that a category that overflows a column continues at the top of the same column on the next page, and SHALL report the number of pages read. The title line `Lista de la compra` SHALL be discarded. The page footer (the generator line and the slogan) SHALL be discarded by its position on the page, not by matching its text, and SHALL appear in no item, anomaly or report.

#### Scenario: A list of two pages
- **WHEN** a list has the category `Pescados, moluscos, crustáceos y derivados` at the bottom of page 1 and its items at the top of page 2
- **THEN** the items belong to that category, and the list is reported as having 2 pages

#### Scenario: Left column overflows while the right column starts on page 1
- **WHEN** page 1 has categories in both columns and the left column continues, without repeating its category header, at the top of page 2
- **THEN** the items at the top of page 2 belong to the last category of the left column of page 1, not to the last category of the right column

#### Scenario: A list of one page
- **WHEN** a list has a single page
- **THEN** it is reported as having 1 page

#### Scenario: Footer never reaches the data
- **WHEN** the last page has a generator line and a slogan below the footer line
- **THEN** neither text appears in any item, in any anomaly or in the report

### Requirement: Categories and items
The system SHALL recognize these category headers: `Azúcar, chocolate y derivados`, `Bebidas (no lácteas)`, `Cárnicos y derivados`, `Cereales y derivados`, `Huevos y derivados`, `Lácteos y derivados`, `Legumbres, semillas, frutos secos y derivados`, `Otros`, `Pescados, moluscos, crustáceos y derivados`, `Frutas y derivados`, `Verduras, hortalizas y derivados`, `Especias` and `Grasas y aceites`; a category may be absent from a list. Under a category, an item line SHALL be `- <name>: <amount>` where the amount is a number followed by `g` or `ml`, or a number alone (a count). The quantity SHALL be that number and the unit `g`, `ml` or none. A decimal comma or point SHALL be accepted. The optional mark `(opcional)` SHALL make the item optional, whether it ends the item line or stands alone on the next line. An item name wrapped on two lines SHALL be joined. The items SHALL keep the order of the PDF, and the same name appearing twice (once normal, once optional) SHALL give two items.

#### Scenario: Item with weight
- **WHEN** the category `Cárnicos y derivados` is followed by `- Pollo (pechuga): 240g`
- **THEN** there is an item in that category named `Pollo (pechuga)`, quantity `240`, unit `g`, not optional

#### Scenario: Item that is a count
- **WHEN** the line is `- Huevo de gallina fresco: 3`
- **THEN** the item has quantity `3` and no unit

#### Scenario: Optional on the same line and on the next
- **WHEN** the lines are `- Uva pasa: 15g (opcional)` and, elsewhere, `- Café: 30g` followed by the line `(opcional)`
- **THEN** both items are optional

#### Scenario: Name wrapped on two lines
- **WHEN** an item name is broken after a word and the amount is on the second line
- **THEN** a single item is produced with the two parts joined by a space

#### Scenario: Same ingredient normal and optional
- **WHEN** a list has `- Sésamo, semilla: 5g` and `- Sésamo, semilla: 5g (opcional)`
- **THEN** two items are produced, one optional, in the order of the PDF

### Requirement: Free-text categories
In `Especias` and `Grasas y aceites` the PDF has no `- name: amount` lines but running text with names separated by ` , ` (a space before the comma), which may wrap across lines and may carry `(opcional)` per name. The system SHALL produce one item per name, with no quantity and no unit, and optional when the name carries the mark. A comma inside a name (`Laurel, hoja`) SHALL NOT split it.

#### Scenario: Names separated by commas
- **WHEN** the category `Especias` is followed by `Curry , Laurel, hoja , Sal`
- **THEN** three items are produced: `Curry`, `Laurel, hoja` and `Sal`, with no quantity and no unit

#### Scenario: Wrapped list with optional names
- **WHEN** the text wraps as `Ajo, en polvo (opcional) , Perejil` and `fresco (opcional)`
- **THEN** the items are `Ajo, en polvo` (optional) and `Perejil fresco` (optional)

### Requirement: Anomalies
The system SHALL report, per menu, each line it cannot place and keep reading: a line outside any category, an item line with no readable amount, and a line in an item category that is neither an item, `(opcional)` nor the continuation of a wrapped name. A list that yields no item at all SHALL be recorded as a failure for its menu.

#### Scenario: Line before the first category
- **WHEN** a line of text precedes the first category header
- **THEN** an anomaly with that line is reported and the list is still read

#### Scenario: Item without readable amount
- **WHEN** an item line has a name but no amount, and the next line does not complete it
- **THEN** an anomaly is reported for that line and the following items are still read

#### Scenario: List without items
- **WHEN** a PDF has no category with items
- **THEN** a failure is recorded for that menu and nothing is saved for it

### Requirement: Saving the lists
The command SHALL save the lists it read in the database, one set of items per menu, in the order of the PDF, and SHALL write no JSON file. Saving a menu SHALL replace all its previous items in one transaction, so running the command twice leaves the same rows, and SHALL NOT remove the items of menus it did not read. Every item SHALL belong to an existing menu: when the menu is not in the database the command SHALL fail for the lists it could not save, naming the missing menu, and SHALL tell the author to run `ingest menu` first. When no list could be read, nothing SHALL be saved.

#### Scenario: Rerun gives the same rows
- **WHEN** the command is run twice over the same files
- **THEN** the database holds the same items after each run, with no duplicates

#### Scenario: Other menus kept
- **WHEN** only `Menu 5` has a list this time and the database holds items of menu `4`
- **THEN** the items of menu `4` are still there

#### Scenario: Menu not ingested yet
- **WHEN** a list belongs to menu `7` and the database has no menu `7`
- **THEN** the command reports that menu `7` is missing, exits with code 1 and saves nothing for it

#### Scenario: Names are data, never SQL
- **WHEN** an item name contains a quote or the text `'; DROP TABLE shopping_item; --`
- **THEN** it is stored as that exact text and the table is intact

### Requirement: Shopping list ingestion report
The command SHALL print a summary and write a QA report, in Markdown, to `qa-lista-compra.md` under the QA directory. Both SHALL include, per menu, the number of pages and items, and in total: lists read, lists with more than one page, items, optional items and items without quantity; and SHALL list every failure and anomaly with the menu it belongs to. The QA directory SHALL be inside the data directory; otherwise the command SHALL print an error and exit with code 1 before reading anything. The exit code SHALL be 1 when any failure was recorded and 0 otherwise.

#### Scenario: Pages in the report
- **WHEN** menus `4` and `1` are read and `4` has two pages
- **THEN** the summary and the QA report show `4` with 2 pages and `1` with 1, and one list with more than one page in total

#### Scenario: QA directory outside data
- **WHEN** the QA directory is outside the data directory
- **THEN** an error is printed, nothing is read or written, and the exit code is 1

#### Scenario: Exit code with failures
- **WHEN** one of the lists could not be read
- **THEN** the report lists the failure, the other lists are saved, and the exit code is 1

### Requirement: Local-only shopping list command
The command `pnpm ingest shopping-list` SHALL take no arguments; any argument SHALL print the usage and exit with code 2 without building the database connection. When the database variables are missing it SHALL name them, exit with code 1 and read nothing. It SHALL use no network service other than the database and no language model.

#### Scenario: Extra argument
- **WHEN** the command is run as `ingest shopping-list extra`
- **THEN** the usage is printed and the exit code is 2

#### Scenario: Missing database variables
- **WHEN** the database connection variables are not set
- **THEN** the missing variable names are printed, the exit code is 1 and no PDF is read
