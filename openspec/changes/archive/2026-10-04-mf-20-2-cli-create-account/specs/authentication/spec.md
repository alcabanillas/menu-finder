## ADDED Requirements

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
