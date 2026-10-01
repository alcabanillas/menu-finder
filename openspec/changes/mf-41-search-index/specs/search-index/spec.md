## Purpose

Puts the menus and recipes of the local JSON files into the Neon database, with one embedding per recipe, so that the search can score the dishes by text and by meaning. The load is idempotent and transactional, and it is the only way data reaches the database.

## ADDED Requirements

### Requirement: Schema by migrations
The system SHALL create the database schema with ordered SQL migrations, each applied once and recorded in the database. The first migration SHALL enable the `vector` extension and create `menu`, `meal`, `menu_dish`, `recipe`, `recipe_ingredient` and `recipe_embedding`. **Every** table the system creates, the migration record included, SHALL have row-level security enabled and no policy, so that only the owner role can read or write it. The command `pnpm ingest migrate` SHALL apply the pending migrations and print the ones it applied.

#### Scenario: Fresh database
- **WHEN** `migrate` runs against an empty database
- **THEN** the `vector` extension and the six tables exist, and every table has row-level security enabled

#### Scenario: Migrations run once
- **WHEN** `migrate` runs twice in a row
- **THEN** the second run applies nothing and the schema is unchanged

#### Scenario: Table without row-level security
- **WHEN** a migration creates a table without enabling row-level security
- **THEN** the schema check test fails and names the table

#### Scenario: Failed migration leaves no trace
- **WHEN** a migration fails half-way
- **THEN** none of its statements remain and it is not recorded as applied

### Requirement: Dataset load
The command `pnpm ingest load` SHALL read `data/menu-platos.json` (`WeeklyMenu[]`) and `data/recetas.json` (`Recipe[]`), validate both, and make the database tables of the dataset equal to them in a single transaction. It SHALL store the menus with their 14 meals and dishes (in the menu's order and positions), every recipe with its title, times, ingredients and **preparation text**, and, for every dish with no recipe file, a recipe row with the dish name and no other text (one per distinct name). The brand, contact data and footer are never read: they are not in the JSON files.

#### Scenario: Whole dataset loaded
- **WHEN** `load` runs on a dataset of two menus and three recipes, one of them used by two dishes
- **THEN** the database has two menus, 28 meals, the menu dishes in their positions, three recipes with their ingredients and preparation, and the two dishes point to the same recipe row

#### Scenario: Dish without recipe
- **WHEN** two dishes in different menus have the same name and no recipe file
- **THEN** both point to one recipe row that has that name and no ingredients, no times and no preparation

#### Scenario: Dish points to an unknown recipe file
- **WHEN** a dish names a recipe file that is not in `recetas.json`
- **THEN** the command exits with code 1, names the menu and the dish, and the database is unchanged

#### Scenario: Missing input file
- **WHEN** `data/recetas.json` does not exist
- **THEN** the command exits with code 1, names the file and the command that generates it (`pnpm ingest recipes`), and the database is unchanged

#### Scenario: Malformed input
- **WHEN** a recipe in `recetas.json` has no `ingredients` array, or the file is not JSON
- **THEN** the command exits with code 1, names the file and the first invalid path, and the database is unchanged

#### Scenario: Preparation is stored
- **WHEN** a recipe has two preparation paragraphs
- **THEN** both are in the database, in order

### Requirement: Idempotent load
Running `load` twice on the same files SHALL leave the same rows. Rows that are no longer in the files SHALL be removed. Embeddings SHALL be kept, and not recomputed, while the text they were computed from and the model are the same.

#### Scenario: Same files, second run
- **WHEN** `load` runs twice on the same files
- **THEN** the table contents are identical after both runs and the second run makes no call to the embedding service

#### Scenario: Recipe removed from the files
- **WHEN** a recipe that was loaded is no longer in `recetas.json` and no dish uses it
- **THEN** after `load` its row, its ingredients and its embedding are gone

#### Scenario: Ingredient changed
- **WHEN** the ingredients of one recipe change between two runs
- **THEN** only the embedding of that recipe is recomputed

### Requirement: Recipe embeddings
For every recipe row the load SHALL store one embedding of the variant `name-ingredients`: the vector of the recipe title (or the dish name, for a row with no recipe) followed by its ingredient names. The model name and the dimensionality SHALL be stored with each vector. The preparation text SHALL NOT be sent to the embedding service.

#### Scenario: Text sent to the service
- **WHEN** a recipe titled `Tortilla de patata` has ingredients `huevo` and `patata` and a preparation text
- **THEN** the text sent to the embedding service contains the title and both ingredient names, and none of the preparation text

#### Scenario: Embedding service fails
- **WHEN** the service returns an error for one of the texts
- **THEN** the command exits with code 1, reports the error without the key, and the database keeps its previous contents

### Requirement: Configuration and secrets
The commands SHALL read the connection string and the embedding service key only from environment variables (`DATABASE_URL_UNPOOLED` for `migrate` and `load`; `GEMINI_API_KEY` for `load`). When one is missing the command SHALL exit with code 1 and name the variable. No message, log line or report SHALL contain the value of a secret.

#### Scenario: Missing variable
- **WHEN** `load` runs without `GEMINI_API_KEY`
- **THEN** it exits with code 1, names `GEMINI_API_KEY` and does not connect to the database

#### Scenario: Connection error text
- **WHEN** the connection fails and the driver's error text contains the connection string
- **THEN** the message printed has the credentials removed

### Requirement: Command usage
`migrate` and `load` SHALL take no arguments. Any other argument SHALL print the usage and exit with code 2.

#### Scenario: Extra argument
- **WHEN** `pnpm ingest load --force` runs
- **THEN** the usage is printed, the exit code is 2 and nothing is read or written
