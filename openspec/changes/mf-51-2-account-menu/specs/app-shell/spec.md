## ADDED Requirements

### Requirement: The account menu offers sign-out

The header of the shell SHALL show an account button labelled "Cuenta" that opens a panel with the email of the signed-in user and the control "Cerrar sesión". The panel SHALL be closed when the page renders, and the button SHALL report whether it is open or closed to assistive technology. The panel SHALL close with the Escape key, giving the focus back to the button, and when the user clicks outside it. The panel SHALL show the email of the signed-in user and SHALL NOT show the user's id or any other data of the user. The shell MAY read the signed-in user to show the email, and SHALL NOT use it to decide who sees a page. Activating "Cerrar sesión" SHALL sign the user out as the requirement "Sign-out from the browser" of `authentication` says.

#### Scenario: Closed by default
- **WHEN** a protected page is rendered
- **THEN** the button "Cuenta" reports that it is closed and "Cerrar sesión" is not shown

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

#### Scenario: No session shows no email
- **WHEN** a request for `/planner` carries no session cookie, or a forged one
- **THEN** the response is a redirect to `/login` and its body has no email and no button "Cuenta"
