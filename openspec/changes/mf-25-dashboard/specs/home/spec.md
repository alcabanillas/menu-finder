# Spec Delta

## Purpose

What `/` shows in each of its two states, decided on the server from the session: an informative home for a visitor and a dashboard of the current week for a signed-in user (UI-home-sin-login).

## ADDED Requirements

### Requirement: The server decides the state of the home from the session

`/` SHALL be reachable without a session. The server SHALL decide what it shows from the session alone: without a valid session, the informative home; with one, the dashboard. It SHALL NOT read any parameter, form field or header to decide it or to choose whose data to show.

#### Scenario: No session gives the informative home
- **WHEN** `/` is requested with no session cookie
- **THEN** the response is 200 with the informative home, and no redirect

#### Scenario: A forged or revoked session gives the informative home
- **WHEN** `/` is requested with a made-up session cookie, and then with the cookie of a session that was signed out
- **THEN** both responses show the informative home and contain no data of any user

#### Scenario: A valid session gives the dashboard
- **WHEN** `/` is requested with a valid session
- **THEN** the page is the dashboard and the browser stays on `/`

#### Scenario: A parameter does not change whose data is shown
- **WHEN** a signed-in user requests `/?userId=<another user's id>`
- **THEN** the dashboard shows the menu and the list of the signed-in user, not those of the other user

### Requirement: The informative home describes the product without data

Without a session, `/` SHALL show a page inside the shell's variant for a visitor that says what the product does and offers an "Acceder" link to `/login`. It SHALL NOT contain menu, dish, recipe or shopping data, data of any user, the deployed version, nor any control to create an account or recover a password (SEG-sistema-cerrado).

#### Scenario: The visitor sees the description and the way in
- **WHEN** a visitor opens `/`
- **THEN** the page has a level-one heading, the description of the product and a link "Acceder" to `/login`

#### Scenario: The visitor reaches the sign-in
- **WHEN** a visitor opens `/` and follows "Acceder"
- **THEN** the browser is on `/login` with the sign-in form

#### Scenario: No data and no sign-up for the visitor
- **WHEN** `/` is requested with no valid session
- **THEN** the response contains no dish or menu name from the catalogue, no email, no version and no control to create an account or recover a password

### Requirement: The dashboard shows the menu of this week

With a session, the dashboard SHALL show the menu the user chose for the current week (Monday to Sunday of today): its number, its first and last date, a link to `/menu` and a link to `/planner` to change it. When the user has no menu for this week, it SHALL say so and link to `/planner` to choose one.

#### Scenario: A menu chosen for this week
- **WHEN** a signed-in user who chose menu 12 for this week opens `/`
- **THEN** the dashboard shows "Menú 12", the dates of this week, a link to `/menu` and a link to `/planner`

#### Scenario: No menu this week
- **WHEN** a signed-in user with no menu for this week opens `/`
- **THEN** the dashboard says there is no menu for this week and links to `/planner`, and shows no dishes of today

### Requirement: The dashboard shows what is on today

With a menu for this week, the dashboard SHALL show today's date and the dishes of today's lunch and dinner, each labelled with its meal. A dish with a recipe SHALL unfold its recipe in place; a dish without one SHALL say it has no recipe.

#### Scenario: Today's lunch and dinner
- **WHEN** a signed-in user whose menu of this week has dishes for today's lunch and dinner opens `/`
- **THEN** the dashboard shows today's date and those dishes under "Comida" and "Cena", and no dish of another day

#### Scenario: A dish unfolds its recipe
- **WHEN** the user activates a dish of today that has a recipe
- **THEN** its recipe is shown in place and the control is marked as expanded

### Requirement: The dashboard shows the progress of the shopping list

The dashboard SHALL show how many items of the user's current shopping list are ticked out of the total, as a progress bar with "N de M", and a link to `/shopping-list`. When the user has no current list, it SHALL say so; when the list of the menu is not available, it SHALL say that instead of showing "0 de 0".

#### Scenario: Progress of the current list
- **WHEN** a signed-in user who ticked 5 of the 40 items of the current list opens `/`
- **THEN** the dashboard shows a progress bar with "5 de 40" and a link to `/shopping-list`

#### Scenario: No current list
- **WHEN** a signed-in user with no current shopping list opens `/`
- **THEN** the dashboard says there is no list yet and shows no progress bar

### Requirement: A failed read does not break the dashboard

When the menu or the shopping list cannot be read, the dashboard SHALL show a message in the block that failed and keep the rest of the page, the shell and the navigation working. It SHALL NOT show the error's detail.

#### Scenario: The menu cannot be read
- **WHEN** reading the menu of this week fails for a signed-in user
- **THEN** the menu block shows that it could not be loaded, the shopping block is still shown, and the page contains no stack trace or error detail

#### Scenario: The list cannot be read
- **WHEN** reading the current shopping list fails for a signed-in user
- **THEN** the shopping block shows that it could not be loaded and the menu block is still shown
