# search-index Specification

## Purpose
Keeps the menus and recipes in the Neon database, with one embedding per recipe row, so that the search can score the dishes by text and by meaning. The ingestion commands save there; `embed` computes the embeddings.

## Requirements

### Requirement: Schema by migrations
The system SHALL create the database schema with ordered SQL migrations, each applied once, in its own transaction, and recorded in the database. **Every** table SHALL have row-level security enabled and no policy, so that only the owner role can read or write it. `pnpm ingest migrate` SHALL apply the pending migrations and print the ones it applied.

#### Scenario: Migrations run once
- **WHEN** `migrate` runs twice in a row
- **THEN** the second run applies nothing

#### Scenario: Table without row-level security
- **WHEN** a migration creates a table without enabling row-level security
- **THEN** the schema check test fails and names the table

### Requirement: Database content
A save SHALL store the recipes or menus it receives, replacing the stored version of the same recipe file or menu number, and SHALL NOT remove the ones it did not receive. Replacing a menu SHALL replace its meals and dishes and SHALL keep the rows of other tables that point to that menu number, such as its shopping items. Recipes SHALL be stored whole (title, times, ingredients and preparation); menus with their meals and dishes in order; a dish with no recipe file SHALL point to a row with the dish name only, one per distinct name. A menu with a dish whose recipe is not in the database SHALL NOT be saved, and the error SHALL name the menu, the dish and the file. Each save SHALL be one transaction.

#### Scenario: Menu not received is kept
- **WHEN** menus 1 and 2 are stored and a save receives only menu 2
- **THEN** menu 1 is still in the database

#### Scenario: Recipe missing from the database
- **WHEN** a save receives menus 1 and 2 and a dish of menu 2 names a recipe that is not in the database
- **THEN** menu 1 is saved, menu 2 is not, and the error names menu 2, the dish and the file

#### Scenario: Shopping list kept when its menu is replaced
- **WHEN** menu 4 is stored with a shopping list and a save receives menu 4 again
- **THEN** the shopping items of menu 4 are still in the database, unchanged

#### Scenario: Replaced menu loses its old dishes
- **WHEN** menu 4 is stored with two lunch dishes and a save receives menu 4 with one different lunch dish
- **THEN** menu 4 has only the new dish

### Requirement: Recipe embeddings
`pnpm ingest embed` SHALL store one embedding per recipe row, computed from its title (or dish name) and its ingredient names, never from the preparation, with the model name stored next to it. It SHALL only call the embedding service for rows with no embedding, or whose text or model changed, and SHALL write nothing if a call fails.

#### Scenario: Nothing changed
- **WHEN** `embed` runs twice and nothing was saved in between
- **THEN** the second run makes no call to the embedding service

#### Scenario: Embedding service fails
- **WHEN** the service returns an error
- **THEN** the command exits with code 1, reports the error without the key, and the stored embeddings are unchanged

### Requirement: Configuration and secrets
The connection string and the key SHALL come only from environment variables: `DATABASE_URL_UNPOOLED` for every command that touches the database, and `GEMINI_API_KEY` for `embed`. A missing one SHALL make the command exit with code 1 naming it, before reading or writing anything. No output SHALL contain a secret.

#### Scenario: Missing variable
- **WHEN** `embed` runs without `GEMINI_API_KEY`
- **THEN** it exits with code 1, names `GEMINI_API_KEY` and does not connect to the database

#### Scenario: Connection error text
- **WHEN** the driver's error text contains the connection string
- **THEN** the message printed has the credentials removed
