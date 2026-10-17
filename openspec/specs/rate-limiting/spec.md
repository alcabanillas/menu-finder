# rate-limiting Specification

## Purpose
Provides durable server-side rate limiting and usage quotas backed by PostgreSQL to throttle brute-force sign-in attempts and cap global LLM invocations.

## Requirements

### Requirement: Durable bucket tracking in PostgreSQL

The system SHALL track rate limit counts and expiration timestamps in a durable PostgreSQL table with row-level security enabled and no public policy.

#### Scenario: Counter increments atomically
- **WHEN** a client performs an action subject to rate limiting with a given key and window
- **THEN** the bucket counter increments atomically, returning the updated count, whether the action is permitted, and the timestamp when the window resets

#### Scenario: Expired bucket resets window
- **WHEN** an action is recorded for a key whose previous window has expired
- **THEN** the bucket counter resets to 1 with a new expiration timestamp calculated from the current time plus the window duration

#### Scenario: Opportunistic purge of stale buckets
- **WHEN** an action is recorded in the rate limiter
- **THEN** expired buckets whose expiration timestamp is older than 1 day (24 hours) are deleted from the database using an index on the expiration column

### Requirement: Composite IP and account failed sign-in throttling

The system SHALL track failed sign-in attempts per combination of client IP address and normalized email. The client IP address SHALL be resolved by the authentication subsystem via an injected port (`ClientIpSource`) and SHALL NOT be accepted as part of user-supplied sign-in input. A client IP and email combination that exceeds 5 failed attempts within a 15-minute window SHALL be blocked from attempting further sign-ins for that account until the window expires.

#### Scenario: Client IP is resolved from injected port
- **WHEN** a sign-in attempt is executed with credentials
- **THEN** the rate limit key uses the client IP provided by the injected `ClientIpSource` port rather than reading client IP from user input

#### Scenario: Account blocked from IP after 5 failed attempts
- **WHEN** a client IP records 5 failed sign-in attempts for an email within 15 minutes
- **THEN** any subsequent sign-in check for that IP and email reports that the action is not allowed and returns the remaining time until reset

#### Scenario: Independent accounts on the same IP are not blocked
- **WHEN** a client IP records 5 failed sign-in attempts for `userA@example.test`
- **THEN** sign-in checks from the same client IP for `userB@example.test` remain permitted

#### Scenario: Successful sign-in clears failed attempts
- **WHEN** a sign-in attempt succeeds from a client IP for an account that has previous recorded failures
- **THEN** the failed attempt counter for that specific IP and account combination is reset

#### Scenario: Unblocked client IP and email is permitted
- **WHEN** a client IP and email combination has fewer than 5 failed attempts recorded in the current window
- **THEN** the sign-in check reports that the action is permitted

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
