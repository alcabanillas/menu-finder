# app-shell Specification

## Purpose
The frame that every page with a session shares: the header, the main navigation and the content area. It says what the frame holds, how the navigation behaves and adapts to the width, and that the frame is not what protects the pages (UI-design-system, UI-home-sin-login).

## Requirements

### Requirement: Pages with a session render inside the shell

Every protected page SHALL render inside a shell made of a header with the product's wordmark and the main navigation, and a content area that is the page's only main landmark. `/login` SHALL NOT render inside the shell, and `/` SHALL render inside it only for a user with a session.

#### Scenario: A protected page has the shell
- **WHEN** a signed-in user opens `/planner`
- **THEN** the page has a header with the wordmark "Menu Finder", the main navigation and exactly one main landmark that holds the content of `/planner`

#### Scenario: The home of a signed-in user has the shell
- **WHEN** a signed-in user opens `/`
- **THEN** the page is inside the shell, with a heading "Hoy" in the main landmark, and "Hoy" is the link marked as the current page

#### Scenario: The sign-in screens have no shell
- **WHEN** `/` or `/login` is requested with no session
- **THEN** the response has no main navigation

### Requirement: The main navigation has four tabs

The shell SHALL offer a navigation labelled "Principal" with four links, in this order: "Hoy" to `/`, "Buscar" to `/planner`, "Menú" to `/menu` and "Compra" to `/shopping-list`. They SHALL be real links that work without JavaScript. The link of the route being shown SHALL be marked as the current page for assistive technology, and no other link SHALL be.

#### Scenario: The four links
- **WHEN** a protected page is rendered
- **THEN** the navigation "Principal" has the links "Hoy", "Buscar", "Menú" and "Compra", in that order, each with the destination above

#### Scenario: The current route is marked
- **WHEN** the shell is rendered for `/planner`
- **THEN** "Buscar" is marked as the current page and "Hoy", "Menú" and "Compra" are not

#### Scenario: A route that is not a tab marks none
- **WHEN** the shell is rendered for a route that none of the four links points to
- **THEN** no link is marked as the current page

#### Scenario: Navigation without JavaScript
- **WHEN** a signed-in user opens `/planner` with JavaScript disabled
- **THEN** the four links are in the page and "Buscar" is marked as the current page

### Requirement: Each of the four tabs leads to a page

`/menu` and `/shopping-list` SHALL exist, inside the shell, so that no tab of the main navigation leads to a missing page. Until the screens that belong there are built, each SHALL show a heading with its name and a line saying what will be there. Each SHALL check the session like any other protected page.

#### Scenario: The Menú and Compra tabs lead to a page
- **WHEN** a signed-in user opens `/menu` or `/shopping-list`
- **THEN** the response is a page inside the shell, with a heading "Menú" or "Compra" respectively, and the matching link of the navigation is marked as the current page

#### Scenario: The new pages need a session
- **WHEN** `/menu` or `/shopping-list` is requested with no session
- **THEN** the response is a redirect to `/login`

### Requirement: The navigation adapts to the width

From 640 px of width the shell SHALL show the tabs in the header. Below 640 px it SHALL show them in a bar at the bottom of the screen. At any width only one of the two SHALL be exposed to assistive technology, so that the four links are not announced twice.

#### Scenario: Wide screen
- **WHEN** a signed-in user opens `/planner` on a screen 1024 px wide
- **THEN** the four links are visible inside the header, and the navigation "Principal" appears once to assistive technology

#### Scenario: Narrow screen
- **WHEN** a signed-in user opens `/planner` on a screen 375 px wide
- **THEN** the four links are visible at the bottom of the screen, below the content, and the navigation "Principal" appears once to assistive technology

### Requirement: The shell can be skipped and has labelled landmarks

The first element that takes the keyboard focus SHALL be a link "Saltar al contenido" that moves the focus to the content area. The shell SHALL expose a banner (the header), the navigation "Principal" and one main landmark.

#### Scenario: The skip link is first
- **WHEN** a signed-in user opens `/planner` and presses Tab once
- **THEN** the focus is on the link "Saltar al contenido"

#### Scenario: The skip link moves the focus
- **WHEN** the user activates the link "Saltar al contenido"
- **THEN** the focus is on the main landmark

### Requirement: The shell is not an access control

The shell SHALL NOT decide who sees a page. Every page inside it SHALL check the session itself, as the requirement "Protected routes require a session checked on the server" of `authentication` says, and a request with no valid session SHALL get a redirect to `/login` with no content of the page and no data of the user in the response. (The layout runs before the page, so the response may carry the empty frame in the data Next sends along with the redirect; the browser follows the redirect and never draws it.)

#### Scenario: No session gets no page
- **WHEN** a request for `/planner` carries no session cookie, or a forged one
- **THEN** the response is a redirect to `/login` and its body has no content of the page and no name of a user

#### Scenario: Every page inside the shell checks the session
- **WHEN** a page is added inside the shell without a session check
- **THEN** the automated check of protected pages fails

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
