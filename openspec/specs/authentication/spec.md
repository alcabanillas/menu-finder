# authentication Specification

## Purpose
Who can have an account in the app, how a user proves who they are, and what a session is and how long it lasts. The system is closed (SEG-sistema-cerrado): nobody registers, accounts are created by the author, and there is one role (SEG-roles). This capability covers the server side only; the login page and the protected routes are MF-20.3. Accounts are created with the CLI command `pnpm ingest account`.

## Requirements

### Requirement: Public sign-up is closed

The system SHALL reject every request to register that comes through its public interface, whatever the email and password, and SHALL NOT create any user, account or session because of it.

#### Scenario: A sign-up request is rejected
- **WHEN** a sign-up request with a valid email and a valid password reaches the public interface
- **THEN** the request is rejected, and no row is added to the users, accounts or sessions tables

#### Scenario: A sign-up request for an email that already has an account
- **WHEN** a sign-up request arrives for the email of an existing account
- **THEN** the answer is the same rejection as for a new email, so that it does not reveal which emails have an account

### Requirement: Accounts are created from server code only

The system SHALL allow trusted server code to create an account with an email and a password, and SHALL store only a hash of the password, never the password. The account has the single role of SEG-roles; there is no role to choose.

#### Scenario: An account is created
- **WHEN** server code creates an account with a valid email and password
- **THEN** one user and one credential account exist for that email, and the stored password value is not the password

#### Scenario: An email that already has an account
- **WHEN** server code creates an account for an email that already has one
- **THEN** the creation fails, and the existing account and its password are unchanged

#### Scenario: Invalid email or password
- **WHEN** server code creates an account with a blank or malformed email, an email longer than 254 characters or with a control character, or with a password shorter than the minimum or longer than the maximum
- **THEN** the creation fails with an error that names the invalid field and no row is added

### Requirement: Sign-in with email and password

The system SHALL start a session when the email and password match an account, and SHALL return the session in a cookie that scripts in the page cannot read and that is only sent over HTTPS in production.

#### Scenario: Correct credentials
- **WHEN** a user signs in with the email and password of an existing account
- **THEN** a session row exists for that user, and the response sets a session cookie marked `HttpOnly`

#### Scenario: Wrong password
- **WHEN** a user signs in with an existing email and a wrong password
- **THEN** the sign-in is rejected and no session row is added

#### Scenario: Unknown email gives the same answer as a wrong password
- **WHEN** a user signs in with an email that has no account
- **THEN** the rejection has the same status and body as the one for a wrong password, so that it does not reveal which emails have an account

### Requirement: Session lifetime and revocation

A session SHALL last 7 days from its last use and SHALL be renewed when it is used more than 1 day after it was last renewed (SEG-auth). The system SHALL revoke a session in the database, so that its cookie stops working at once.

#### Scenario: An expired session
- **WHEN** a request carries the cookie of a session that was last renewed more than 7 days ago
- **THEN** the system treats the request as having no session

#### Scenario: A session used after one day is renewed
- **WHEN** a request carries the cookie of a valid session that was last renewed more than 1 day ago
- **THEN** the session stays valid and its expiry moves 7 days forward from that use

#### Scenario: A session used within a day is not renewed
- **WHEN** a request carries the cookie of a valid session that was renewed less than 1 day ago
- **THEN** the session stays valid and its expiry does not change

#### Scenario: A revoked session
- **WHEN** a session is signed out
- **THEN** its row no longer exists, and a request with its old cookie is treated as having no session

### Requirement: The session cookie cannot be forged

The system SHALL sign the session cookie with a secret that comes from the environment, and SHALL refuse to start without that secret.

#### Scenario: A modified cookie
- **WHEN** a request carries a session cookie whose value was changed after it was issued
- **THEN** the system treats the request as having no session

#### Scenario: A cookie signed with another secret
- **WHEN** a request carries a cookie issued by a system configured with a different secret
- **THEN** the system treats the request as having no session

#### Scenario: The secret is missing
- **WHEN** the authentication is set up with no secret
- **THEN** the setup fails with an error that names the missing variable and does not include any secret value

### Requirement: Hostile input does not break the authentication

The system SHALL treat every email and password as data. Values with SQL metacharacters, emoji, combining accents, very long text or null bytes SHALL NOT cause a server error, change other rows or leak internal details.

#### Scenario: Hostile values at sign-in
- **WHEN** a sign-in request carries an email such as `' OR 1=1; --`, an emoji, a 10 000-character value or a null byte
- **THEN** the sign-in is rejected like any other wrong credentials, with no server error and no change in the database

### Requirement: Authentication tables are not reachable without the owner role

Every authentication table SHALL have row-level security enabled and no policy, so that only the owner role of the server reads or writes it (safety-first §2.3).

#### Scenario: Row-level security on every table
- **WHEN** the authentication migration has been applied
- **THEN** each of its tables has row-level security enabled and no policy

### Requirement: Accounts are created with a CLI command

The system SHALL provide a command that creates an account from an email, an optional display name and a password, and SHALL report the email of the new account on success. The display name defaults to the part of the email before the `@`, cut at 30 characters; a name is at most 30 characters long and holds no control character. The account created is the same as the one of "Accounts are created from server code only": one user, one credential account, a stored hash and the single role. The command is the only way to create an account, including the demo account for the tutor (SEG-sistema-cerrado).

#### Scenario: An account is created and can sign in
- **WHEN** the command is run with a valid email and a valid password
- **THEN** it exits with code 0, prints the email of the new account, and a sign-in with that email and password starts a session

#### Scenario: The display name is not given
- **WHEN** the command is run for `ana@example.test` with no name
- **THEN** the account is created with the name `ana`

#### Scenario: The part of the email before the @ is longer than a name may be
- **WHEN** the command is run with no name for an email whose part before the `@` has 40 characters
- **THEN** the account is created with the first 30 characters of that part as its name

#### Scenario: An email that already has an account
- **WHEN** the command is run for the email of an existing account
- **THEN** it exits with code 1, prints that the email already has an account, and the existing account and its password are unchanged

#### Scenario: Invalid email, password or name
- **WHEN** the command is run with a blank or malformed email, an email longer than 254 characters or with a control character, a password shorter than the minimum or longer than the maximum, or a name longer than 30 characters or with a control character
- **THEN** it exits with code 1, prints which field is invalid, and no row is added

#### Scenario: Hostile values
- **WHEN** the command is run with an email or name such as `' OR 1=1; --`, an emoji, a 10 000-character value or a null byte
- **THEN** it exits with code 0 or 1 according to the rules above (a name of 10 000 characters or with a null byte is refused as an invalid name), never with a crash or a stack trace, no internal database message reaches the output, and no row other than the new account is changed

#### Scenario: Wrong number of arguments
- **WHEN** the command is run with no email, or with more than an email and a name
- **THEN** it prints its usage, exits with code 2, reads no password and connects to nothing

#### Scenario: Missing environment variables
- **WHEN** the command is run with `DATABASE_URL_UNPOOLED` or `BETTER_AUTH_SECRET` unset or empty
- **THEN** it exits with code 1, names every missing variable, does not include any secret value, and does not connect to the database

### Requirement: The password is read from a prompt or stdin and never shown

The command SHALL read the password from a prompt that does not echo it when stdin is a terminal, and from one line of stdin otherwise. It SHALL NOT accept the password as an argument or from an environment variable, and SHALL NOT print it, in any output or error line.

#### Scenario: Password from stdin
- **WHEN** the password is piped to the command through stdin
- **THEN** the account is created with that password, and the output does not contain it

#### Scenario: Password in an argument is not read
- **WHEN** the command is run with a third argument that looks like a password
- **THEN** it is treated as a wrong number of arguments (usage, exit code 2) and the value is not stored or printed

#### Scenario: A failing creation does not print the password
- **WHEN** a creation fails for any reason (invalid email, repeated email, database error)
- **THEN** no line of the output contains the password

#### Scenario: No password given
- **WHEN** stdin is closed or the line read is empty
- **THEN** the command exits with code 1, prints that a password is required, and no row is added
