## RENAMED Requirements

- FROM: `### Requirement: Global daily LLM invocation limit`
- TO: `### Requirement: Daily LLM invocation limit per user`

## MODIFIED Requirements

### Requirement: Daily LLM invocation limit per user

The system SHALL enforce a daily ceiling on LLM invocations for each user, counted on the user of the session. There SHALL be no ceiling shared by all users: a user who reaches the limit SHALL NOT stop the searches of another. The limit SHALL default to 100 invocations per user and calendar day (UTC) unless overridden by the `LLM_DAILY_LIMIT` environment variable; a value that is not a positive integer SHALL fall back to the default. One search of the web from the text of a request SHALL count as one invocation, whatever the number of calls it makes to the model provider, and it SHALL be counted before any of them. A request that is empty once trimmed, or longer than 300 characters, SHALL be refused before it is counted, so it SHALL NOT consume the limit. The limit SHALL apply to the web only: the CLI runs locally and SHALL NOT consume it. When the limit is reached, the web search SHALL return an `llm-limit-reached` outcome and SHALL make no call to the model provider and no search.

#### Scenario: LLM call permitted under daily limit
- **WHEN** a web search of a user arrives and that user's daily invocation count has not reached the configured limit
- **THEN** the search is permitted and that user's daily counter increments by 1

#### Scenario: LLM call rejected when daily limit is reached
- **WHEN** a web search of a user arrives and that user's daily invocation count has reached the limit
- **THEN** the outcome is `llm-limit-reached`, and neither the decomposer, the embedding service nor the menu search is called

#### Scenario: One user's limit does not stop another
- **WHEN** `LLM_DAILY_LIMIT` is `2`, user A has run two web searches today and user B none
- **THEN** the next search of A is `llm-limit-reached` and the next search of B is permitted

#### Scenario: Daily counter rolls over on a new day
- **WHEN** the first web search of a user arrives on a new calendar day (UTC) after that user reached the previous day's limit
- **THEN** a new bucket is initiated for that user and day, and the search is permitted

#### Scenario: Limit overridden by configuration
- **WHEN** `LLM_DAILY_LIMIT` is `2` and a user has run two web searches today
- **THEN** that user's third web search of the day is `llm-limit-reached`

#### Scenario: Invalid limit configuration
- **WHEN** `LLM_DAILY_LIMIT` is `0`, `-5` or `abc`
- **THEN** the limit is 100

#### Scenario: CLI not limited
- **WHEN** the `search-text` command runs
- **THEN** no hit is recorded in any daily LLM bucket

#### Scenario: An invalid request is not counted
- **WHEN** a web search arrives with a request that is only spaces, or with a request of 301 characters
- **THEN** the outcome is `request-too-short` or `request-too-long`, no hit is recorded in the user's daily LLM bucket, and the decomposer is not called
