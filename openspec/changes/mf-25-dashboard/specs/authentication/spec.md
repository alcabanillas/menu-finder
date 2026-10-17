## MODIFIED Requirements

### Requirement: Sign-in from the browser

The system SHALL offer a page at `/login` with an email field, a password field and a submit button, and SHALL start a session when the email and password match an account. On success it SHALL go to `/`. On failure it SHALL stay on `/login` and show one message that is the same for an unknown email and a wrong password. The page SHALL NOT offer sign-up or password recovery (SEG-sistema-cerrado).

#### Scenario: Correct credentials
- **WHEN** a user submits the email and password of an existing account on `/login`
- **THEN** the browser ends on `/` with the dashboard, a session row exists for that user, and the browser holds a session cookie marked `HttpOnly`

#### Scenario: Wrong password and unknown email look the same
- **WHEN** a user submits an existing email with a wrong password, and then an email that has no account
- **THEN** both stay on `/login` with the same message, and no session row is added

#### Scenario: No sign-up or recovery on the page
- **WHEN** `/login` is rendered
- **THEN** it has no link or control to create an account or to recover a password

#### Scenario: Already signed in
- **WHEN** a user with a valid session opens `/login`
- **THEN** the browser is sent to `/`

### Requirement: The sign-in sends the user to a fixed place

After a successful sign-in the system SHALL go to `/`, whatever the request carries. It SHALL NOT read a redirect target from the URL, the form or a header.

#### Scenario: A redirect target in the URL is ignored
- **WHEN** a user opens `/login?next=https://evil.example` (or `callbackURL`, `redirect`, `returnTo`) and signs in correctly
- **THEN** the browser ends on `/` of the app

## REMOVED Requirements

### Requirement: The home shows the sign-in until the dashboard exists

**Reason**: MF-25 builds the informative home and the dashboard of UI-home-sin-login; `/` no longer renders the sign-in form.
**Migration**: What `/` shows in each state is now in the `home` capability ("The server decides the state of the home from the session" and the requirements after it). The sign-in form is only at `/login`, reached from the home's "Acceder" link.
