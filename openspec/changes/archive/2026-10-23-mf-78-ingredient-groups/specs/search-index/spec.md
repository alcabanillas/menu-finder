## ADDED Requirements

### Requirement: Ingredient food groups
`pnpm ingest ingredient-groups` SHALL classify each distinct ingredient name of `recipe_ingredient` into the 16 canonical food groups (`BUS-superficie-consulta (c)`) with the model and store one row per ingredient name in `ingredient_group` with its groups (empty when none applies) and the model name. It SHALL only call the model for ingredient names with no row or from another model, and SHALL write nothing if the call or validation fails.

#### Scenario: Nothing changed
- **WHEN** `ingredient-groups` runs twice and no new ingredient name was saved in between
- **THEN** the second run makes no call to the model and prints that all ingredient names were kept

#### Scenario: Ingredient in no canonical food group
- **WHEN** `recipe_ingredient` contains `"sal"` and the model classifies it into `[]`
- **THEN** `"sal"` is stored in `ingredient_group` with an empty group list so a subsequent run does not send `"sal"` to the model again

#### Scenario: Database has no ingredients
- **WHEN** `ingredient-groups` runs and `recipe_ingredient` has no rows
- **THEN** the command exits with code 1, tells the operator to run `pnpm ingest recipes` first, and makes no call to the model

#### Scenario: Model returns an invalid group or omits an ingredient
- **WHEN** the model returns a group outside the canonical list or omits a requested ingredient name
- **THEN** the command exits with code 1, reports the invalid answer, and leaves `ingredient_group` unchanged

#### Scenario: Model call fails
- **WHEN** the model service returns an error whose text contains the API key
- **THEN** the command exits with code 1, reports the error without the key, and leaves `ingredient_group` unchanged

## MODIFIED Requirements

### Requirement: Configuration and secrets
The connection string and the key SHALL come only from environment variables: `DATABASE_URL_UNPOOLED` for every command that touches the database, and `GEMINI_API_KEY` for `embed` and `ingredient-groups`. A missing one SHALL make the command exit with code 1 naming it, before reading or writing anything. No output SHALL contain a secret.

#### Scenario: Missing variable
- **WHEN** `embed` or `ingredient-groups` runs without `GEMINI_API_KEY`
- **THEN** it exits with code 1, names `GEMINI_API_KEY` and does not connect to the database

#### Scenario: Connection error text
- **WHEN** the driver's error text contains the connection string
- **THEN** the message printed has the credentials removed
