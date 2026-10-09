## ADDED Requirements

### Requirement: Rate limiting on sign-in

The system SHALL refuse sign-in requests from a client IP address and account combination that has recorded 5 or more failed sign-in attempts within the active 15-minute window without evaluating credentials against the session manager or database. The response SHALL provide a rate-limit error message to the user ("Demasiados intentos. Espera unos minutos."). When a sign-in succeeds, the system SHALL clear the failed attempt history for that client IP and account combination.

#### Scenario: Sign-in refused due to rate limiting
- **WHEN** a sign-in request arrives for an email from a client IP that has reached 5 failed attempts for that email in the last 15 minutes
- **THEN** the sign-in is rejected with a rate-limit error, credentials are not verified against the account store, and no session is created

#### Scenario: Another account from the same client IP can sign in
- **WHEN** a client IP has reached 5 failed attempts for `userA@example.test` but attempts to sign in as `userB@example.test` with valid credentials
- **THEN** the sign-in is evaluated normally, a session is created, and the request is not blocked

#### Scenario: Successful sign-in clears failed attempts
- **WHEN** a sign-in request succeeds with valid credentials from a client IP that had prior recorded failures for that email
- **THEN** a session is created and the failed attempt counter for that client IP and email is reset to zero

#### Scenario: Failed sign-in increments failure counter
- **WHEN** a sign-in request fails due to wrong credentials or invalid input from an unblocked client IP and email
- **THEN** the sign-in is rejected and the failed attempt count for that combination is incremented by 1

#### Scenario: Rate-limited sign-in attempt is logged
- **WHEN** a sign-in request is rejected due to active rate limiting
- **THEN** one log line records a refused sign-in with reason `rate-limited` and timestamp, containing neither email nor password
