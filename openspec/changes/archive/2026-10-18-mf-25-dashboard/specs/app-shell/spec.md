## MODIFIED Requirements

### Requirement: Pages with a session render inside the shell

Every protected page SHALL render inside a shell made of a header with the product's wordmark and the main navigation, and a content area that is the page's only main landmark. `/login` SHALL NOT render inside the shell. `/` SHALL render inside the shell in both states: with the main navigation for a user with a session, and in the variant with no session for a visitor.

#### Scenario: A protected page has the shell
- **WHEN** a signed-in user opens `/planner`
- **THEN** the page has a header with the wordmark "Menu Finder", the main navigation and exactly one main landmark that holds the content of `/planner`

#### Scenario: The home of a signed-in user has the shell
- **WHEN** a signed-in user opens `/`
- **THEN** the page is inside the shell, with the level-one heading "Qué toca hoy" in the main landmark, and "Hoy" is the link marked as the current page

#### Scenario: The sign-in screens have no shell
- **WHEN** `/` or `/login` is requested with no session
- **THEN** the response has no main navigation

#### Scenario: The home of a visitor has the variant with no session
- **WHEN** a visitor opens `/`
- **THEN** the page has the header with the wordmark and the link "Acceder", the skip link and exactly one main landmark, and no button "Cuenta"

### Requirement: The shell takes its variant from the account

The shell SHALL have a variant for a visitor with no session: the header with the wordmark and a link "Acceder" to `/login`, no main navigation, no bottom bar and no account button. It SHALL keep the skip link and the main landmark. The shell SHALL take the variant from the account it is given (the signed-in user's email and the sign-out action): with an account it is the variant with a session, without one it is the variant with no session. There SHALL be no separate input for the state, so the state and the account cannot disagree. `/` with no session SHALL render this variant; `/login` keeps rendering the sign-in form outside the shell, and a protected page with no session redirects before anything is drawn.

#### Scenario: The variant with no session offers the sign-in
- **WHEN** the shell is rendered without an account
- **THEN** the header has the wordmark, linking to `/`, and a link "Acceder" to `/login`; there is no navigation "Principal" and no button "Cuenta"; the skip link and one main landmark are there

#### Scenario: An account gives the variant with a session
- **WHEN** the shell is rendered with the account of a signed-in user
- **THEN** it has the navigation "Principal" with its four links and the button "Cuenta", and no link "Acceder"
