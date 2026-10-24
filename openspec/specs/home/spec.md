# home Specification

## Purpose
What `/` shows in each of its two states, decided on the server from the session: an informative home for a visitor and a dashboard of the current week for a signed-in user (UI-home-sin-login).

## Requirements

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

Without a session, `/` SHALL show a page inside the shell's variant for a visitor that says what the product does and offers "Acceder" links to `/login`: a cover with the level-one heading and the first link, a sample search beside it, three features each with a sample piece of the app, and a closing block with the second link. The sample pieces SHALL be hidden from screen readers and SHALL hold no control. Their dishes SHALL be invented: the page SHALL NOT contain a dish of the catalogue, data of any user, the deployed version, nor any control to create an account or recover a password (SEG-sistema-cerrado).

#### Scenario: The visitor sees the description and the way in
- **WHEN** a visitor opens `/`
- **THEN** the page has the level-one heading "Planifica la semana sin darle vueltas", the text "Dile qué te apetece como se lo dirías a alguien de casa. Te enseña los menús de la nutricionista que encajan y el plato que lo demuestra.", the line "36 menús · recetas con tiempos · compra por categorías" and two links "Acceder" to `/login`

#### Scenario: Three features and a closing block
- **WHEN** a visitor opens `/`
- **THEN** the page has the level-two headings "La semana, de un vistazo", "Cada plato, con su receta", "La compra, por categorías" and "¿Qué os apetece esta semana?", in that order, and the sentence "Escríbelo como te salga y te enseñamos los menús que encajan."

#### Scenario: The sample pieces show the app
- **WHEN** a visitor opens `/`
- **THEN** the page shows the request "de cuchara, sin cerdo y con garbanzos" with the chips "de cuchara", "cerdo" and "garbanzos", the card "Menú 14" with the line "✓ cerdo · no aparece en la semana", six day cards from Monday to Saturday, an open recipe card with its ingredients and steps, and one shopping category with three items

#### Scenario: The sample pieces are not operable
- **WHEN** a visitor opens `/`
- **THEN** every sample piece is hidden from screen readers and out of the tab order, and the only links or buttons a screen reader or the keyboard reaches in the page's main content are the two "Acceder" links

#### Scenario: The cover beside the sample search from 800 px
- **WHEN** a visitor opens `/` in an 800 px container or wider
- **THEN** the sample search is to the right of the heading; below 800 px it is below the "Acceder" link

#### Scenario: The visitor reaches the sign-in
- **WHEN** a visitor opens `/` and follows "Acceder"
- **THEN** the browser is on `/login` with the sign-in form

#### Scenario: No data and no sign-up for the visitor
- **WHEN** `/` is requested with no valid session
- **THEN** the response contains no dish of the menus in the database, no email, no version and no control to create an account or recover a password

#### Scenario: The sample dishes are not from the catalogue
- **WHEN** the sample dishes of the home are compared with the dishes and recipes of the local catalogue
- **THEN** none of them matches a dish or a recipe title of the catalogue

### Requirement: The dashboard shows what is on today

The dashboard's level-one heading SHALL be "Qué toca hoy", with today's date above it, and the colour bar of that date SHALL be the day's colour; Sunday's, which is white, SHALL have a thin `border-strong` border so that it shows. With a menu for this week, it SHALL show the dishes of today's lunch and dinner, each meal under its label, and a link "Ver menú" to `/menu`. A meal with no dishes SHALL NOT be shown; when today has no dishes at all, it SHALL say that the menu has no dishes for today. On a Sunday, which never has dishes, it SHALL show instead a grey card with a sun icon in a circle, the title "Domingo libre" and the text "¡Día libre! Hoy la cocina queda a vuestro gusto.", and SHALL NOT show the link "Ver menú". On a phone the meals SHALL go one below the other, and a dish with a recipe SHALL unfold its recipe in place; a dish without one SHALL say it has no recipe. From an 800 px container the meals SHALL go side by side, each dish a row with its total time; a dish with a recipe SHALL be a control that opens its recipe in the modal panel of `/menu`, against the right edge of the window, and nothing SHALL unfold in the page. Escape or the panel's close button SHALL close it and return the focus to the dish.

#### Scenario: Today's lunch and dinner
- **WHEN** a signed-in user whose menu of this week has dishes for today's lunch and dinner opens `/`
- **THEN** the page has the heading "Qué toca hoy" with today's date, those dishes under "Comida" and "Cena", no dish of another day, and a link "Ver menú" to `/menu`

#### Scenario: A day with no dishes
- **WHEN** a signed-in user whose menu of this week has no dishes for today, and today is not a Sunday, opens `/`
- **THEN** the page says "El menú no incluye platos para hoy." and shows neither "Comida" nor "Cena"

#### Scenario: Sunday is a rest day
- **WHEN** a signed-in user whose menu of this week has no dishes for Sunday opens `/` on that Sunday
- **THEN** the page shows a card titled "Domingo libre" with the text "¡Día libre! Hoy la cocina queda a vuestro gusto.", does not say "El menú no incluye platos para hoy.", shows neither "Comida" nor "Cena" for today, and has no link "Ver menú"

#### Scenario: Sunday's colour bar shows
- **WHEN** a signed-in user opens `/` on a Sunday
- **THEN** the colour bar by today's date has the class of a thin `border-strong` border, and the bar of any other day has none

#### Scenario: On a phone a dish unfolds its recipe
- **WHEN** the user, below an 800 px container, activates a dish of today that has a recipe
- **THEN** its recipe is shown in place and the control is marked as expanded

#### Scenario: From 800 px a dish opens its recipe in the side panel
- **WHEN** the user, from an 800 px container, activates a dish of today that has a recipe
- **THEN** a modal dialog with the recipe opens against the right edge of the window, over a dark backdrop, nothing unfolds in the page, and the control is marked as expanded

#### Scenario: Closing the panel returns to the dish
- **WHEN** the recipe panel is open and the user presses Escape or the panel's close button
- **THEN** the panel closes and the focus is on the dish that opened it

### Requirement: The dashboard shows the names of tomorrow's dishes

With a menu for this week, after today's dishes and the link "Ver menú", the dashboard SHALL show "Mañana" with tomorrow's weekday and day number, and only the names of tomorrow's lunch and dinner dishes, one per line, under "Comida" and "Cena": no times, no recipes and no controls. A meal with no dishes SHALL NOT be shown. On a Sunday, tomorrow SHALL be next week's Monday, taken from the user's menu for next week, and the block SHALL read "Mañana · Lunes 26 · Menú 31" (the Monday's weekday and day number and the number of that menu), with a link "Ver el menú de la semana que viene" to `/menu` for that week. When next week has no menu, the block SHALL be replaced by a notice with the title "La semana que viene aún no tiene menú", the text "Mañana empieza otra semana. Elige uno en Buscar: escribe lo que os apetece y verás los menús que encajan." and a primary button "Elegir menú para el 26 oct" (next Monday's short date) to `/planner?week=next`. When tomorrow has no dishes, the block SHALL NOT be shown. Whose next week is read SHALL come from the session only.

#### Scenario: Tomorrow's dishes
- **WHEN** a signed-in user whose menu has, for tomorrow (Saturday 17), "Arroz al horno" for lunch and "Tortilla francesa" for dinner opens `/`
- **THEN** the page shows "Mañana · sábado 17", "Arroz al horno" under "Comida" and "Tortilla francesa" under "Cena", with no control and no time on them

#### Scenario: Tomorrow without dishes
- **WHEN** a signed-in user whose menu has no dishes for tomorrow, and today is not a Sunday, opens `/`
- **THEN** the page has no "Mañana"

#### Scenario: On Sunday, tomorrow is next week's Monday
- **WHEN** a signed-in user with a menu this week and, for next week, a menu with "Lentejas estofadas" for Monday 26's lunch opens `/` on Sunday 25
- **THEN** the page shows "Mañana · Lunes 26 · Menú 31" (the number of that menu) and "Lentejas estofadas" under "Comida", with no control and no time on it, and a link "Ver el menú de la semana que viene" to `/menu?startsOn=2026-10-26`

#### Scenario: On Sunday, next week has no menu yet
- **WHEN** a signed-in user with a menu this week and none for next week opens `/` on a Sunday 25 October
- **THEN** the page has no "Mañana" block but a notice titled "La semana que viene aún no tiene menú", with the text "Mañana empieza otra semana. Elige uno en Buscar: escribe lo que os apetece y verás los menús que encajan." and a button "Elegir menú para el 26 oct" to `/planner?week=next`, and shows no dish

#### Scenario: On Sunday, next week's Monday has no dishes
- **WHEN** a signed-in user whose menu for next week has no dishes for Monday opens `/` on a Sunday
- **THEN** the page has no "Mañana"

#### Scenario: A parameter does not change whose next week is shown
- **WHEN** a signed-in user with no menu for next week requests `/?userId=<id of another user who has a menu for next week>` on a Sunday
- **THEN** the notice "La semana que viene aún no tiene menú" is shown and none of the other user's dishes or menu number

#### Scenario: Next week cannot be read
- **WHEN** reading next week's menu fails for a signed-in user on a Sunday
- **THEN** the page has no "Mañana", keeps today's block, the card of the weeks and the shopping block, and contains no error detail

### Requirement: The dashboard says what to do when this week has no menu

When the user has no menu for this week, the dashboard SHALL show, instead of today's dishes, a notice that this week has no menu, and SHALL NOT show "Ver menú". While this week can still take a menu, the notice SHALL link to `/planner?week=current` to choose one. When this week is locked because next week already has a menu (the shopping list is already next week's), the notice SHALL say so, name next week's menu, and link to `/menu` on next week.

#### Scenario: This week can still take a menu
- **WHEN** a signed-in user with no menu for this week and none for next week opens `/`
- **THEN** the page says "Esta semana aún no tiene menú" and has a link "Elegir menú para esta semana" to `/planner?week=current`, and no link "Ver menú"

#### Scenario: This week is locked by next week's menu
- **WHEN** a signed-in user with no menu for this week who chose menu 31 for next week opens `/`
- **THEN** the page says "Esta semana no tiene menú", names "Menú 31", and has a link "Ver el menú de la semana que viene" to `/menu?startsOn=<next Monday>`, and no link to choose a menu for this week

### Requirement: The dashboard shows this week and next week

The dashboard SHALL show one card with this week and next week. This week: its dates and "Menú N" when it has a menu. Next week, below: with a menu, its dates and "Menú N"; without one, "Sin elegir" and a link "Elegir" to `/planner?week=next`. When this week has no menu, the card SHALL say "Sin menú" for it and SHALL be shown only from an 800 px container (on a phone the notice of today already says it).

#### Scenario: Both weeks with a menu
- **WHEN** a signed-in user with menu 26 this week and menu 31 next week opens `/`
- **THEN** the card shows this week's dates with "Menú 26" and next week's dates with "Menú 31", and no link "Elegir"

#### Scenario: Next week without a menu
- **WHEN** a signed-in user with menu 26 this week and no menu next week opens `/`
- **THEN** the card shows "Menú 26", "Sin elegir" for next week and a link "Elegir" to `/planner?week=next`

### Requirement: The dashboard shows the progress of the shopping list

The dashboard SHALL show how many items of the user's current shopping list are ticked out of the total, as a progress bar with "N de M", under a title that names the week of the list ("Compra · semana del 19 oct"), taken from the list itself, and a link "Abrir" to `/shopping-list`. When the user has no current list, it SHALL say that the list appears when a menu is chosen, with no link "Abrir"; when the list of the menu is not available, it SHALL say that instead of showing "0 de 0".

#### Scenario: Progress of the current list
- **WHEN** a signed-in user who ticked 5 of the 40 items of the current list, which is the list of the week of 19 October, opens `/`
- **THEN** the dashboard shows "Compra · semana del 19 oct", a progress bar with "5 de 40" and a link "Abrir" to `/shopping-list`

#### Scenario: No current list
- **WHEN** a signed-in user with no current shopping list opens `/`
- **THEN** the dashboard says "Aún no hay lista: aparece al elegir un menú." and shows no progress bar and no link "Abrir"

### Requirement: A failed read does not break the dashboard

When today's menu, the weeks or the shopping list cannot be read, the dashboard SHALL show a message in the block that failed and keep the rest of the page, the shell and the navigation working. It SHALL NOT show the error's detail.

#### Scenario: The menu cannot be read
- **WHEN** reading the menu of this week fails for a signed-in user
- **THEN** the block of today shows that the menu could not be loaded, the shopping block is still shown, and the page contains no stack trace or error detail

#### Scenario: The weeks cannot be read
- **WHEN** reading this week's and next week's selections fails for a signed-in user
- **THEN** the card of the weeks shows that it could not be loaded, and the shopping block is still shown

#### Scenario: The list cannot be read
- **WHEN** reading the current shopping list fails for a signed-in user
- **THEN** the shopping block shows that it could not be loaded and the card of the weeks is still shown
