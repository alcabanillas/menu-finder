## ADDED Requirements

### Requirement: Search from a request
The search SHALL also run from the text of a request: the request is decomposed with one call to the model (spec `request-decomposer`) and, when the answer is a structure with at least one constraint, the menus are searched with that structure, unchanged. The result SHALL hold the structure and the ranking together. Every outcome of the decomposer that is not a structure with constraints (a refused request, a rejection, an invalid answer, a model failure, or a structure with no constraints) SHALL end with its own outcome, with no search and no database or embedding call. A structure with no constraints SHALL be an outcome of its own, distinct from a rejection and from an invalid structure. A failure of the search SHALL end with an error and no partial ranking.

#### Scenario: Request searched
- **WHEN** the request is "algo con pollo" and the decomposer returns a structure with the literal constraint `pollo`
- **THEN** the menus are searched with that structure and the result holds the structure and the ranking

#### Scenario: One call to the model
- **WHEN** a request is searched
- **THEN** the model is called exactly once

#### Scenario: Rejected request
- **WHEN** the decomposer returns the rejection `gibberish`
- **THEN** the outcome is the rejection with its category and no database or embedding call is made

#### Scenario: Invalid answer
- **WHEN** the decomposer refuses the answer of the model because a term is not in the request
- **THEN** the outcome names the problem and no database or embedding call is made

#### Scenario: Model failure
- **WHEN** the call to the model fails with an error whose message contains the API key
- **THEN** the outcome is a failure whose reason does not contain the key, and no database or embedding call is made

#### Scenario: Request too long
- **WHEN** the request has 301 characters
- **THEN** it is refused as too long, the model is not called and no database call is made

#### Scenario: Structure with no constraints
- **WHEN** the decomposer returns a structure with no constraints and no groups for "platos para el finde"
- **THEN** the outcome says there is nothing to search, it is not a rejection, and no database or embedding call is made

#### Scenario: Search failure
- **WHEN** the decomposer returns a structure and the database cannot be reached
- **THEN** the outcome is an error with no ranking and no credentials in the text

### Requirement: Search-text command
`pnpm ingest search-text "<request>" [--strategy lexical|semantic|hybrid]` SHALL search the menus from the text of the request (default strategy `semantic`, as in `ingest search`, always over `DATABASE_URL_UNPOOLED`) and print the structure as JSON, then the top five, the tie count and the menus each hard constraint removes, as `ingest search` prints them. It SHALL need `GEMINI_API_KEY` with every strategy, because the decomposer needs it, and both variables SHALL be checked before the model is called. It SHALL exit with code 0 for a ranking, empty or not; with code 3 for a rejection or a structure with no constraints; with code 1 for a refused request, an invalid answer, a model failure, a search failure or a missing variable; and with code 2 and the usage when it does not get exactly one request or gets an unknown option or strategy. Every printed line SHALL pass through `redactSecrets`. The request text SHALL NOT be written to any file.

#### Scenario: Run a search from a request
- **WHEN** the command runs with "cenas rápidas sin alitas" and the decomposer returns a structure
- **THEN** the structure is printed as JSON, then the ranking, and the exit code is 0

#### Scenario: Strategy option
- **WHEN** the command runs with a request and `--strategy lexical`
- **THEN** the search uses the lexical strategy and the printed ranking names it

#### Scenario: Rejection at the command
- **WHEN** the command runs with "asdfgh" and the decomposer returns the rejection `gibberish`
- **THEN** the rejection and its category are printed, no ranking is printed and the exit code is 3

#### Scenario: Nothing to search at the command
- **WHEN** the decomposer returns a structure with no constraints
- **THEN** the command prints that the request gives nothing to search, no ranking is printed and the exit code is 3

#### Scenario: Invalid answer at the search-text command
- **WHEN** the decomposer refuses the answer of the model
- **THEN** each problem is printed and the exit code is 1

#### Scenario: Request too long at the search-text command
- **WHEN** the command runs with a request of 301 characters
- **THEN** the message says the request is too long and the exit code is 1

#### Scenario: Without the Gemini key
- **WHEN** `GEMINI_API_KEY` is not set, with `--strategy lexical` or the default
- **THEN** the exit code is 1, the message names the variable, never its value, and the model is not called

#### Scenario: Without the database URL
- **WHEN** `DATABASE_URL_UNPOOLED` is not set
- **THEN** the exit code is 1, the message names the variable, never its value, and the model is not called

#### Scenario: Secret in a failure
- **WHEN** the search fails with a message that contains the connection string
- **THEN** the printed message does not contain it and the exit code is 1

#### Scenario: No request
- **WHEN** the command runs with no argument
- **THEN** the usage is printed and the exit code is 2

#### Scenario: Two requests
- **WHEN** the command runs with two arguments that are not an option
- **THEN** the usage is printed and the exit code is 2

#### Scenario: Unknown strategy at the search-text command
- **WHEN** the command runs with a request and `--strategy fuzzy-magic`
- **THEN** the usage is printed and the exit code is 2

## MODIFIED Requirements

### Requirement: Search command
`pnpm ingest search <structure.json> [--strategy lexical|semantic|hybrid]` SHALL read the structure from the file, validate it (the file MAY be a request of the decomposer golden set: the command drops its `id`, `text` and `origin` before the search, and passes every other key on), run the search (default strategy `semantic`, the best strategy overall in `evals/search/results.md`, always over `DATABASE_URL_UNPOOLED`; `GEMINI_API_KEY` is required only with `semantic` and `hybrid`) and print the top five, the tie count and the menus each hard constraint removes. It SHALL exit with code 1 when the file is missing, is not JSON or is not a valid structure (naming the file and the field), and with code 2 and the usage when the arguments are wrong.

#### Scenario: Run a search
- **WHEN** the command runs on a valid file with `--strategy lexical`
- **THEN** the ranking is printed and the exit code is 0

#### Scenario: Golden-set request as the file
- **WHEN** the file is a request of the decomposer golden set, with its `id`, `text` and `origin`
- **THEN** the command searches with its constraints and groups, and those three keys do not change the ranking

#### Scenario: Unknown key in a golden-set file
- **WHEN** the file is a golden-set request with an extra key `hrad`
- **THEN** the exit code is 1 and the message names `hrad`

#### Scenario: Lexical without a key
- **WHEN** `GEMINI_API_KEY` is not set and the command runs with `--strategy lexical`
- **THEN** the ranking is printed and the exit code is 0

#### Scenario: Semantic without a key
- **WHEN** `GEMINI_API_KEY` is not set and the command runs with `--strategy semantic` or the default
- **THEN** the exit code is 1 and the message names the variable, never its value

#### Scenario: Missing file
- **WHEN** the file does not exist
- **THEN** the exit code is 1 and the message names the file

#### Scenario: Default strategy
- **WHEN** the command runs on a valid file with no `--strategy`, and `GEMINI_API_KEY` is set
- **THEN** the search uses the `semantic` strategy and the printed ranking names it

#### Scenario: Unknown strategy
- **WHEN** `--strategy fuzzy-magic` is given
- **THEN** the usage is printed and the exit code is 2
