## Purpose

Provides durable server-side rate limiting and usage quotas backed by PostgreSQL to throttle brute-force sign-in attempts and cap global LLM invocations.

## ADDED Requirements

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

The system SHALL track failed sign-in attempts per combination of client IP address and normalized email. A client IP and email combination that exceeds 5 failed attempts within a 15-minute window SHALL be blocked from attempting further sign-ins for that account until the window expires.

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

### Requirement: Global daily LLM invocation limit

The system SHALL enforce a global daily ceiling on LLM invocations across all users and IP addresses. The limit SHALL default to 100 invocations per calendar day (UTC) unless overridden by environment configuration.

#### Scenario: LLM call permitted under daily limit
- **WHEN** an LLM invocation request arrives and the daily invocation count has not reached the configured limit
- **THEN** the invocation is permitted and the daily counter increments by 1

#### Scenario: LLM call rejected when daily limit is reached
- **WHEN** an LLM invocation request arrives and the daily invocation count has reached the limit
- **THEN** the invocation is rejected as rate-limited, and no call is dispatched to the Gemini API provider

#### Scenario: Daily counter rolls over on a new day
- **WHEN** the first LLM request arrives on a new calendar day (UTC) after the previous day's limit was reached
- **THEN** a new bucket is initiated for the new day and the request is permitted
