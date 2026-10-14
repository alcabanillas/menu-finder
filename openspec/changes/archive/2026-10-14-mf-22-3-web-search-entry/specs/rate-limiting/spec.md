## MODIFIED Requirements

### Requirement: Global daily LLM invocation limit

The system SHALL enforce a global daily ceiling on LLM invocations across all users and IP addresses. The limit SHALL default to 100 invocations per calendar day (UTC) unless overridden by the `LLM_DAILY_LIMIT` environment variable; a value that is not a positive integer SHALL fall back to the default. One search of the web from the text of a request SHALL count as one invocation, whatever the number of calls it makes to the model provider, and it SHALL be counted before any of them. The limit SHALL apply to the web only: the CLI runs locally and SHALL NOT consume it. When the limit is reached, the web search SHALL return an `llm-limit-reached` outcome and SHALL make no call to the model provider and no search.

#### Scenario: LLM call permitted under daily limit
- **WHEN** a web search arrives and the daily invocation count has not reached the configured limit
- **THEN** the search is permitted and the daily counter increments by 1

#### Scenario: LLM call rejected when daily limit is reached
- **WHEN** a web search arrives and the daily invocation count has reached the limit
- **THEN** the outcome is `llm-limit-reached`, and neither the decomposer, the embedding service nor the menu search is called

#### Scenario: Daily counter rolls over on a new day
- **WHEN** the first web search arrives on a new calendar day (UTC) after the previous day's limit was reached
- **THEN** a new bucket is initiated for the new day and the search is permitted

#### Scenario: Limit overridden by configuration
- **WHEN** `LLM_DAILY_LIMIT` is `2` and two web searches have run today
- **THEN** the third web search of the day is `llm-limit-reached`

#### Scenario: Invalid limit configuration
- **WHEN** `LLM_DAILY_LIMIT` is `0`, `-5` or `abc`
- **THEN** the limit is 100

#### Scenario: CLI not limited
- **WHEN** the `search-text` command runs
- **THEN** no hit is recorded in the daily LLM bucket
