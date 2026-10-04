## ADDED Requirements

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
- **THEN** the page renders and shows the name of the signed-in user and the sign-out control

### Requirement: The home shows the sign-in until the dashboard exists

`/` SHALL be reachable without a session. The server SHALL decide what it shows from the session: without one, the same sign-in form as `/login`, with no catalogue or user data and no sign-up or recovery; with one, it SHALL send the browser to `/planner`. The informative home and the dashboard of UI-home-sin-login come in later changes.

#### Scenario: Home without a session
- **WHEN** `/` is requested with no valid session
- **THEN** it renders the sign-in form, and no menu, recipe or user data and no sign-up or recovery control

#### Scenario: Sign-in from the home
- **WHEN** a user submits correct credentials on `/`
- **THEN** the browser ends on `/planner` and a session row exists for that user

#### Scenario: Home with a session
- **WHEN** `/` is requested with a valid session
- **THEN** the browser is sent to `/planner`

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
