## MODIFIED Requirements

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
