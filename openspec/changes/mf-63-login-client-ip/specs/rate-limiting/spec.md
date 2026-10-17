# Spec Delta: rate-limiting

## MODIFIED Requirements

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
