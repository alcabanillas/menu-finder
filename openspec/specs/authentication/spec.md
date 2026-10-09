# authentication Specification

## Purpose
Who can have an account in the app, how a user proves who they are, how routes are protected by a server-side session check, and what a session is and how long it lasts. The system is closed (SEG-sistema-cerrado): nobody registers, accounts are created by the author, and there is one role (SEG-roles). It covers the browser sign-in page, sign-out, session verification for protected routes, and the server side. Accounts are created with the CLI command `pnpm ingest account`.

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

### Requirement: Sign-in from the browser

The system SHALL offer a page at `/login` with an email field, a password field and a submit button, and SHALL start a session when the email and password match an account. On success it SHALL go to `/planner`. On failure it SHALL stay on `/login` and show one message that is the same for an unknown email and a wrong password. The page SHALL NOT offer sign-up or password recovery (SEG-sistema-cerrado).

#### Scenario: Correct credentials
- **WHEN** a user submits the email and password of an existing account on `/login`
- **THEN** the browser ends on `/planner`, a session row exists for that user, and the browser holds a session cookie marked `HttpOnly`

#### Scenario: Wrong password and unknown email look the same
- **WHEN** a user submits an existing email with a wrong password, and then an email that has no account
- **THEN** both stay on `/login` with the same message, and no session row is added

#### Scenario: No sign-up or recovery on the page
- **WHEN** `/login` is rendered
- **THEN** it has no link or control to create an account or to recover a password

#### Scenario: Already signed in
- **WHEN** a user with a valid session opens `/login`
- **THEN** the browser is sent to `/planner`

### Requirement: The sign-in input is validated on the server

The system SHALL check on the server, before asking the authentication library, that the email and password are text, that neither is empty after trimming the email, and that neither is longer than its limit (254 characters for the email, 128 for the password, as in MF-20.1). The email SHALL be normalised (Unicode NFC, surrounding spaces removed) before the check. A value that fails the check SHALL be answered like wrong credentials, except an empty field, which SHALL get a message naming the field. The check SHALL hold when the sign-in is called directly, without the form.

#### Scenario: An empty field
- **WHEN** a sign-in is submitted with an empty email or an empty password
- **THEN** the page says which field is required, and the library is not asked

#### Scenario: Hostile values
- **WHEN** a sign-in is submitted, through the form or directly, with an email or password such as `' OR 1=1; --`, an emoji, a 10 000-character value or a null byte
- **THEN** it is refused with the wrong-credentials message, with no server error, no stack trace and no change in the database

#### Scenario: Missing fields in a direct call
- **WHEN** the sign-in is called directly with no email field, no password field, or a field that is not text
- **THEN** it is refused like an empty field, with no server error

### Requirement: Sign-in errors are announced every time
The sign-in form SHALL show the message the server returns in an element with the alert role inside the form, and SHALL replace that element with a new one on every answer, so that assistive technology announces the message each time, also when it is the same as the previous one.

#### Scenario: An error is announced
- **WHEN** a sign-in is submitted and the server answers with a message
- **THEN** the form shows an alert with that message

#### Scenario: The same error twice in a row is announced again
- **WHEN** two sign-ins in a row get the same message from the server
- **THEN** after the second answer the alert is a different element from the one shown after the first, with the same text

#### Scenario: No alert before the first answer
- **WHEN** the sign-in form is rendered and nothing has been submitted
- **THEN** the form has no alert

### Requirement: The sign-in form checks the fields before sending
The sign-in form SHALL check, when it is submitted, that the email is not empty, that it has the shape of an address (text, `@`, text, a dot, text, with no spaces), and that the password is not empty. A field that fails SHALL show a message under it ("Escribe tu correo.", "Revisa el formato del correo." or "Escribe tu contraseña."), SHALL be marked invalid and linked to its message for assistive technology, and nothing SHALL be sent to the server. These checks SHALL only look at what was typed. They do not replace the validation on the server, which SHALL hold when the form is sent without them.

#### Scenario: Empty fields
- **WHEN** the form is submitted with both fields empty
- **THEN** the email shows "Escribe tu correo.", the password shows "Escribe tu contraseña.", both are marked invalid, and the server action is not called

#### Scenario: An email without the shape of an address
- **WHEN** the form is submitted with the email `ana@correo` and a password
- **THEN** the email shows "Revisa el formato del correo." and the server action is not called

#### Scenario: Valid fields are sent
- **WHEN** the form is submitted with `ana@example.test` and a password
- **THEN** no field message is shown and the server action receives both values

#### Scenario: The server holds without the form checks
- **WHEN** the form is sent with JavaScript disabled and an email such as `' OR 1=1; --`
- **THEN** the server answers with the wrong-credentials message, as without the checks

### Requirement: The password can be shown
The password field SHALL have a control, labelled "Mostrar" while the password is hidden and "Ocultar" while it is shown, that switches the field between hidden and visible text and reports its state to assistive technology as pressed or not pressed. The password SHALL be hidden when the form is rendered. The control SHALL NOT submit the form.

#### Scenario: Hidden by default
- **WHEN** the sign-in form is rendered
- **THEN** the password field is of type `password` and the control says "Mostrar" and is not pressed

#### Scenario: Shown and hidden again
- **WHEN** the user activates the control, and then activates it again
- **THEN** the field shows the text and the control says "Ocultar" and is pressed; then the field hides it again and the control says "Mostrar"

#### Scenario: The control does not submit
- **WHEN** the user activates the control with both fields filled in
- **THEN** the server action is not called

### Requirement: The sign-in form shows that it is working
While a sign-in is in flight, the submit button SHALL say "Entrando…" and SHALL be disabled, so the form cannot be sent twice.

#### Scenario: Pending sign-in
- **WHEN** a valid sign-in has been submitted and the server has not answered yet
- **THEN** the button says "Entrando…" and is disabled

### Requirement: No authentication endpoint is exposed

The web SHALL reach the authentication only through its own sign-in and sign-out actions. It SHALL NOT expose the authentication library's HTTP endpoints, so that none of them (sign-up, user update, password change, session listing) can be called from outside.

#### Scenario: Library endpoints do not exist
- **WHEN** a request is sent to `/api/auth/sign-up/email`, `/api/auth/sign-in/email`, `/api/auth/update-user` or `/api/auth/list-sessions`
- **THEN** the response is 404 and no row is added or changed

### Requirement: The sign-in sends the user to a fixed place

After a successful sign-in the system SHALL go to `/planner`, whatever the request carries. It SHALL NOT read a redirect target from the URL, the form or a header.

#### Scenario: A redirect target in the URL is ignored
- **WHEN** a user opens `/login?next=https://evil.example` (or `callbackURL`, `redirect`, `returnTo`) and signs in correctly
- **THEN** the browser ends on `/planner` of the app

### Requirement: Sign-out from the browser

The system SHALL offer a sign-out control to a signed-in user. Signing out SHALL revoke the session in the database, clear the session cookie and go to `/`.

#### Scenario: Sign-out revokes the session
- **WHEN** a signed-in user signs out
- **THEN** the browser ends on `/`, the session row no longer exists, and opening `/planner` with the old cookie goes to `/login`

#### Scenario: Sign-out without a session
- **WHEN** sign-out is called with no session cookie
- **THEN** the browser ends on `/` with no server error

### Requirement: Protected routes require a session checked on the server

Every route other than `/` and `/login` SHALL be protected. A protected route SHALL check the session on the server before reading any data or rendering its content, and SHALL send a request with no valid session to `/login`. A missing cookie, an expired session, a revoked session and a modified or foreign-signed cookie SHALL all count as no valid session (MF-20.1). `/planner` is the protected route of this change.

#### Scenario: No session cookie
- **WHEN** a request for `/planner` carries no session cookie
- **THEN** the response is a redirect to `/login`, and the body of `/planner` is not in the response

#### Scenario: A forged cookie
- **WHEN** a request for `/planner` carries a session cookie with a made-up or modified value
- **THEN** the response is a redirect to `/login`

#### Scenario: A signed-out cookie
- **WHEN** a request for `/planner` carries the cookie of a session that was signed out
- **THEN** the response is a redirect to `/login`

#### Scenario: A valid session
- **WHEN** a request for `/planner` carries the cookie of a valid session
- **THEN** the page renders inside the app shell and shows the name of the signed-in user, and the sign-out control is in the account menu of the shell

### Requirement: The home shows the sign-in until the dashboard exists

`/` SHALL be reachable without a session. The server SHALL decide what it shows from the session: without one, the same sign-in form as `/login`, with no catalogue or user data and no sign-up or recovery; with one, a minimal page "Hoy" inside the app shell, a placeholder for the dashboard. The informative home and the dashboard of UI-home-sin-login come in later changes.

#### Scenario: Home without a session
- **WHEN** `/` is requested with no valid session
- **THEN** it renders the sign-in form, and no menu, recipe or user data and no sign-up or recovery control

#### Scenario: Sign-in from the home
- **WHEN** a user submits correct credentials on `/`
- **THEN** the browser ends on `/planner` and a session row exists for that user

#### Scenario: Home with a session
- **WHEN** `/` is requested with a valid session
- **THEN** the page renders inside the app shell with the heading "Hoy", and the browser stays on `/`

### Requirement: Sign-ins and sign-outs are logged

The system SHALL write one structured log line for each successful sign-in, each refused sign-in and each sign-out, with the event, the time and the user id when there is one. A log line SHALL NOT contain the email, the password, the session token or the cookie (safety-first §4).

#### Scenario: A successful sign-in is logged
- **WHEN** a user signs in correctly
- **THEN** one log line records a sign-in with that user's id and the time, and contains neither the email nor the password

#### Scenario: A refused sign-in is logged
- **WHEN** a sign-in is refused for wrong credentials or invalid input
- **THEN** one log line records a refused sign-in with the time and the reason class (wrong credentials or invalid input), with no user id, no email and no password

#### Scenario: A sign-out is logged
- **WHEN** a signed-in user signs out
- **THEN** one log line records a sign-out with that user's id and the time, and no session token

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
