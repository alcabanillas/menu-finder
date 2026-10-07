## ADDED Requirements

### Requirement: The account menu offers sign-out

The header of the shell, for a user with a session (on `/` and on every protected page), SHALL show an account button labelled "Cuenta" that opens a panel with the email of the signed-in user and the control "Cerrar sesión". The panel SHALL be closed when the page renders, and the button SHALL report whether it is open or closed to assistive technology. The panel SHALL close with the Escape key, giving the focus back to the button, and when the user clicks outside it. The panel SHALL show the email of the signed-in user and SHALL NOT show the user's id or any other data of the user. The shell MAY read the signed-in user to show the email, and SHALL NOT use it to decide who sees a page. Activating "Cerrar sesión" SHALL sign the user out as the requirement "Sign-out from the browser" of `authentication` says.

#### Scenario: Closed by default
- **WHEN** a protected page is rendered
- **THEN** the button "Cuenta" reports that it is closed and "Cerrar sesión" is not shown

#### Scenario: The home of a signed-in user has the menu too
- **WHEN** a signed-in user opens `/`
- **THEN** the header has the button "Cuenta", closed, and opening it shows the email and "Cerrar sesión"

#### Scenario: Open
- **WHEN** the user activates the button "Cuenta"
- **THEN** the button reports that it is open and the control "Cerrar sesión" is shown

#### Scenario: Escape closes the panel and returns the focus
- **WHEN** the panel is open and the user presses Escape
- **THEN** the panel is closed and the focus is on the button "Cuenta"

#### Scenario: A click outside closes the panel
- **WHEN** the panel is open and the user clicks outside it
- **THEN** the panel is closed

#### Scenario: The menu shows the email and no other user data
- **WHEN** the panel is open for a user whose email is `ana@example.test`
- **THEN** it shows `ana@example.test` and the sign-out control, and no user id

#### Scenario: Signing out from the menu
- **WHEN** a signed-in user opens the account menu and activates "Cerrar sesión"
- **THEN** the browser ends on `/`, the session row no longer exists, and opening `/planner` with the old cookie goes to `/login`

#### Scenario: A request with no valid session gets no email
- **WHEN** a request for `/planner` carries the cookie of a session that was signed out
- **THEN** the response is a redirect to `/login` and its body does not contain the email of that account

### Requirement: The shell takes its variant from the account

The shell SHALL have a variant for a visitor with no session: the header with the wordmark and a link "Acceder" to `/login`, no main navigation, no bottom bar and no account button. It SHALL keep the skip link and the main landmark. The shell SHALL take the variant from the account it is given (the signed-in user's email and the sign-out action): with an account it is the variant with a session, without one it is the variant with no session. There SHALL be no separate input for the state, so the state and the account cannot disagree. No route shows the variant with no session in this change: `/` with no session and `/login` keep rendering the sign-in form outside the shell until the informative home exists, and a protected page with no session redirects before anything is drawn.

#### Scenario: The variant with no session offers the sign-in
- **WHEN** the shell is rendered without an account
- **THEN** the header has the wordmark, linking to `/`, and a link "Acceder" to `/login`; there is no navigation "Principal" and no button "Cuenta"; the skip link and one main landmark are there

#### Scenario: An account gives the variant with a session
- **WHEN** the shell is rendered with the account of a signed-in user
- **THEN** it has the navigation "Principal" with its four links and the button "Cuenta", and no link "Acceder"

## REMOVED Requirements

### Requirement: The shell has a variant for no session
**Reason**: Replaced by "The shell takes its variant from the account". The variant with a session was the default when nothing was said, through a `session` input separate from the account; with the account menu the two could disagree (a signed-in shell with no way to sign out).
**Migration**: Render the shell with the account of the signed-in user for the variant with a session, and without an account for the variant with no session.
