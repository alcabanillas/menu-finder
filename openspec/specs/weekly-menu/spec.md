# weekly-menu Specification

## Purpose
`/menu` shows a signed-in user the menu they chose for this week, with every day in one vertical scroll on narrow screens and one card per day from 800 px, with the recipe of each dish as a card that unfolds in place (UI-card-receta).

## Requirements

### Requirement: The page shows the active menu's week

`/menu` SHALL show to a signed-in user their active menu: the menu of their selection that starts on the Monday of the week that holds today, with "today" being the date in Europe/Madrid. The page SHALL have a heading "Menú N", with N the menu number, and above it "Semana del D de MES", with the Monday it starts on. When the content is narrower than 800 px, it SHALL show a sticky day navigation bar with buttons for all seven days of that week, Monday to Sunday, each with its weekday and the day of the month. Today's button SHALL carry a distinctive mark. The bar SHALL stay below the app's sticky header. On initial load, when the week holds today, the page SHALL position the viewport at today's day section; otherwise it SHALL open at the top.

#### Scenario: The week of the active menu
- **WHEN** a signed-in user whose active menu is 3, from Monday 2026-10-05, opens `/menu` on Wednesday 2026-10-07 on a screen narrower than 800 px
- **THEN** the heading reads "Menú 3", the line above it reads "Semana del 5 de octubre", the sticky bar shows the days 5 to 11, Wednesday 7 is marked as today, and the view is anchored at Wednesday's section

#### Scenario: Next week's menu is not the active one
- **WHEN** a signed-in user whose only selection starts on the next Monday opens `/menu`
- **THEN** the page shows no menu and says there is no menu for this week

#### Scenario: A week without today opens at the top
- **WHEN** the user opens on a screen narrower than 800 px a week that does not hold today
- **THEN** the page does not scroll and the heading and the week navigation stay in view

#### Scenario: The bar stays under the header
- **WHEN** the user scrolls the page on a screen narrower than 800 px
- **THEN** the day navigation bar stays visible right below the app's header, not behind it

### Requirement: The selected day shows its dishes

When the content is narrower than 800 px, the page SHALL show all days of the week in sequential vertical scroll order. Each day SHALL display its weekday and date written in Spanish ("Miércoles 7 de octubre"), followed by its dishes under "Comida" and "Cena" in the menu's order. Activating a day button in the sticky navigation bar SHALL scroll the page so that day's section starts right below the bar, without animation when the user prefers reduced motion. The arrow keys, Home and End SHALL move the focus among the day buttons and activate the day they reach. As the user scrolls through the days, the sticky day navigation bar SHALL detect the day currently in view and update the active day indicator accordingly. A day with no dishes SHALL state "El menú no incluye platos para este día". Without JavaScript, all days of the week SHALL remain rendered in vertical order.

#### Scenario: Today's dishes
- **WHEN** the page opens on Wednesday and the menu has two dishes for Wednesday's lunch and one for its dinner
- **THEN** the page anchors at Wednesday's section showing "Miércoles 7 de octubre", the two dishes under "Comida" and the one under "Cena", in the menu's order

#### Scenario: Selecting another day
- **WHEN** the user selects the Monday button in the sticky bar
- **THEN** the page scrolls to Monday's section and the Monday button becomes the active one

#### Scenario: Moving with the keyboard
- **WHEN** the Wednesday button has the focus and the user presses the right arrow
- **THEN** the Thursday button gets the focus and becomes the active one, and the page scrolls to Thursday's section

#### Scenario: Reduced motion
- **WHEN** a user who prefers reduced motion selects the Monday button
- **THEN** the page jumps to Monday's section without a smooth scroll

#### Scenario: A day with no dishes
- **WHEN** the menu has no dishes for a day in the weekly menu
- **THEN** that day's section says "El menú no incluye platos para este día" and shows no "Comida" or "Cena"

#### Scenario: Without JavaScript
- **WHEN** a signed-in user with JavaScript disabled opens `/menu` on a screen narrower than 800 px
- **THEN** the page renders all seven days and their dishes in the document

#### Scenario: All days rendered in continuous scroll
- **WHEN** the user opens `/menu` on mobile with a menu that has dishes across multiple weekdays
- **THEN** all seven days are present in the DOM in sequence without requiring tab clicks to reveal subsequent days

#### Scenario: A short last day
- **WHEN** today is Sunday and the menu has no dishes for Sunday
- **THEN** the page opens with Sunday's section right below the bar and the Sunday button is the active one, not Saturday's

#### Scenario: Scrolling updates active day in sticky bar
- **WHEN** the user scrolls past Monday's section into Tuesday's section
- **THEN** the sticky navigation bar highlights Tuesday as the active day

### Requirement: A dish unfolds into its recipe

When the content is narrower than 800 px, each dish SHALL be shown as a card with its name. A dish with a recipe SHALL show its total time when known and the mark "Receta", and SHALL be a control that unfolds and folds the recipe in place, announcing whether it is unfolded. The unfolded recipe SHALL show the total, preparation and cooking times in minutes, with a dash for an unknown time; the ingredients in the recipe's order, each with its household measure and its quantity and unit when known, and "opcional" when it is optional; and the preparation steps, numbered, in order. A dish without a recipe SHALL say "Sin receta" and SHALL NOT be a control.

#### Scenario: Unfolding a recipe
- **WHEN** the user activates a dish whose recipe takes 45 minutes in total, 10 of preparation and 35 of cooking, with the ingredient "Lentejas" of 240 g and two preparation steps
- **THEN** the card shows 45, 10 and 35 minutes, "Lentejas" with "240 g", and the two steps numbered 1 and 2, and it is announced as unfolded

#### Scenario: Folding a recipe
- **WHEN** the user activates an unfolded dish
- **THEN** the recipe is hidden and the card is announced as folded

#### Scenario: Amounts, optional ingredients and unknown times
- **WHEN** a recipe has an ingredient with the household measure "1 cucharada" and 10 ml, an optional ingredient, and no cooking time
- **THEN** the first reads "1 cucharada · 10 ml", the second carries "opcional", and the cooking time shows a dash

#### Scenario: A dish without a recipe
- **WHEN** the day has a dish without a recipe
- **THEN** its card shows the name and "Sin receta", and it is not a control

### Requirement: The page without a menu to show

When the user has no active menu, the page SHALL have the heading "Semana sin menú" and SHALL show the notice of the week (see "A week without a menu says what the user can do"). When the menu cannot be read, the page SHALL have the heading "Menú" and SHALL say that the menu could not be loaded, without any detail of the failure.

#### Scenario: No menu chosen for this week
- **WHEN** a signed-in user with no active menu opens `/menu`
- **THEN** the page has the heading "Semana sin menú" and a notice that says this week has no menu

#### Scenario: The menu cannot be read
- **WHEN** reading the user's selection, the menu or its recipes fails
- **THEN** the page says the menu could not be loaded and shows no detail of the error

### Requirement: Only the user's own menu, and only with a session

`/menu` SHALL check the session before reading anything and SHALL take no input from the request: the user SHALL come from the session, and the page SHALL show only that user's active menu and the recipes of its dishes.

#### Scenario: Opening the menu without a session
- **WHEN** `/menu` is requested with no session
- **THEN** the response is a redirect to `/login` and no menu is read

#### Scenario: Another user's menu is not shown
- **WHEN** another user has an active menu and a signed-in user with no active menu opens `/menu`
- **THEN** the page says there is no menu for this week

#### Scenario: Parameters in the request are ignored
- **WHEN** a signed-in user opens `/menu` with query parameters naming another user or another menu
- **THEN** the page shows the signed-in user's own active menu

### Requirement: From 800 px the page shows the week as day cards

When the content is 800 px wide or wider, the page SHALL show the active menu's week as one card per day instead of the vertical scroll of days: Monday to Saturday, and Sunday only when the menu has dishes for it, in the order of the week. Each card SHALL be headed by its weekday and its date ("7 de octubre"). Today's card SHALL be highlighted and SHALL say "Hoy" in text, not only by colour. Under the labels "Comida" and "Cena", each card SHALL show the dishes of that meal in the menu's order; a meal with no dishes SHALL be left out, and a day with no dishes SHALL say "El menú no incluye platos para este día". A dish with a recipe SHALL show its total time in minutes when known and SHALL be a control that opens its recipe; a dish without one SHALL be plain text. Without JavaScript, the cards SHALL still show every day's dishes.

#### Scenario: The week as day cards
- **WHEN** a signed-in user whose active menu is 3, from Monday 2026-10-05, with dishes on every day, opens `/menu` on Wednesday 2026-10-07 on a screen 800 px wide or wider
- **THEN** the page shows seven day cards, from "Lunes" "5 de octubre" to "Domingo" "11 de octubre", each with its dishes under "Comida" and "Cena", the Wednesday card highlighted and saying "Hoy", and no day tabs

#### Scenario: Sunday without dishes is left out
- **WHEN** the menu has no dishes for Sunday
- **THEN** the page shows six day cards, Monday to Saturday

#### Scenario: A meal with no dishes
- **WHEN** a day has dishes for lunch but none for dinner
- **THEN** that day's card shows "Comida" with its dishes and no "Cena"

#### Scenario: A day with no dishes
- **WHEN** the menu has dishes on Sunday but none on Tuesday
- **THEN** Tuesday's card says "El menú no incluye platos para este día" and shows no "Comida" or "Cena"

#### Scenario: Dishes with and without a recipe
- **WHEN** a meal holds a dish whose recipe takes 45 minutes in total and a dish without a recipe
- **THEN** the first is a control that opens a dialog and shows "45 min", and the second is plain text with no time

#### Scenario: The cards without JavaScript
- **WHEN** a signed-in user with JavaScript disabled opens `/menu` on a screen 800 px wide or wider
- **THEN** the page shows every day's card with its dishes

### Requirement: The page moves between weeks from its header

The `/menu` page SHALL show, in its header, a previous-week control, a next-week control and a control that returns to the current week. The page SHALL show the week chosen by the `startsOn` query parameter, whose value is the Monday of that week as `YYYY-MM-DD`. Without that parameter, the page SHALL show the current week. The return control SHALL show on every week but the current one.

#### Scenario: Going back one week
- **WHEN** the user with a session activates the previous-week control on the current week
- **THEN** the page shows the week that starts seven days earlier, and its dates are those of that week

#### Scenario: Going forward one week
- **WHEN** the user with a session activates the next-week control on the current week
- **THEN** the page shows the week that starts seven days later

#### Scenario: Returning to the current week
- **WHEN** the user is viewing another week and activates the current-week control
- **THEN** the page shows the current week without a `startsOn` parameter

#### Scenario: The return control shows on a past week and on next week
- **WHEN** the user views a past week, and then next week
- **THEN** both pages show the control "Esta semana", and the page of the current week does not

### Requirement: The look-back window is ten weeks

The page SHALL allow viewing up to ten weeks before the current week. The previous-week control SHALL stay enabled for every week inside the window, whether or not that week has a menu. Once the tenth week back is shown, the previous-week control SHALL be disabled.

#### Scenario: The previous-week control stays enabled over a week without menu
- **WHEN** the user views a week back with no selection of their own
- **THEN** the previous-week control is enabled and the page shows the empty week message

#### Scenario: The tenth week back is the last one reachable
- **WHEN** the user views the tenth week back, whose Monday is seventy days before the current Monday
- **THEN** the previous-week control is disabled

#### Scenario: A week older than the window is not shown
- **WHEN** a request asks for a `startsOn` more than seventy days before the current Monday
- **THEN** the page shows the current week instead of an error

### Requirement: The look-ahead window is the next week

The page SHALL allow viewing only the week after the current one, not any later week. The next-week control SHALL be disabled when the next week is shown.

#### Scenario: A week beyond the next one is not shown
- **WHEN** a request asks for a `startsOn` more than seven days after the current Monday
- **THEN** the page shows the current week instead of an error

#### Scenario: Next week is reachable and then the control is disabled
- **WHEN** the user views the next week
- **THEN** the next-week control is disabled

### Requirement: A week without menu shows the empty state with a link to the planner

When the displayed week has no selection of the user, the page SHALL show only the notice of the week below its header: no dishes, no error and no placeholder for the days, Sunday included. The notice SHALL have `role="status"`. It is the same notice that the dashboard shows when this week has no menu.

#### Scenario: Empty week
- **WHEN** the user views a week inside the window with no selection
- **THEN** the page shows one notice with `role="status"` and no card for any day of the week

### Requirement: The startsOn parameter is validated before use

The page SHALL accept `startsOn` only when it is a single string of exactly ten characters in `YYYY-MM-DD` form that names a real calendar date, is a Monday, and lies inside the window. The page SHALL use the validated date only, never the raw string. Any other value SHALL be ignored, and the page SHALL show the current week without reporting an error.

#### Scenario: Not a date
- **WHEN** `startsOn` is `not-a-date`
- **THEN** the page shows the current week and reports no error

#### Scenario: Wrong format
- **WHEN** `startsOn` is `2026/10/05`, `05-10-2026` or `2026-10-5`
- **THEN** the page shows the current week

#### Scenario: Impossible calendar date
- **WHEN** `startsOn` is `2026-02-30` or `2026-13-01`
- **THEN** the page shows the current week and the date does not roll over into another day

#### Scenario: Surrounding whitespace
- **WHEN** `startsOn` is a valid Monday with a leading or trailing space
- **THEN** the page shows the current week

#### Scenario: Not a Monday
- **WHEN** `startsOn` is a Wednesday inside the window
- **THEN** the page shows the current week

#### Scenario: Repeated parameter
- **WHEN** the URL carries `startsOn` twice, as `startsOn=2026-10-05&startsOn=2026-09-28`
- **THEN** the page shows the current week and neither value is used

#### Scenario: Oversized value
- **WHEN** `startsOn` is longer than ten characters
- **THEN** the page shows the current week without parsing the whole value

#### Scenario: Injection-shaped value
- **WHEN** `startsOn` contains SQL or markup text, such as `2026-10-05' OR '1'='1`
- **THEN** the page shows the current week, and the text is neither executed nor rendered

#### Scenario: Boundary Mondays are accepted
- **WHEN** `startsOn` is the Monday seventy days before the current Monday, or the Monday seven days after it
- **THEN** the page shows that week

### Requirement: Only the user's own menus are shown, and only with a session

The week shown SHALL be laid from the signed-in user's own selection for that week. A request without a session SHALL NOT show any menu.

#### Scenario: Request without a session
- **WHEN** a request for `/menu` arrives without a session
- **THEN** the request is redirected to sign-in and no menu data is rendered

#### Scenario: Another user's selection is not shown
- **WHEN** the user with a session asks for a week in which only another user has a selection
- **THEN** the page shows the empty-menu message for that week and no dish of the other user

### Requirement: A week without a menu says what the user can do

The notice of a week without a menu SHALL have four cases, by where the week sits and whether this week is closed (next week already has a menu, which is the rule of Buscar). In a past week it SHALL be grey, say "No se eligió menú para esta semana" and "Las semanas pasadas no se pueden cambiar.", and have no button. In this week, when it is not closed, it SHALL be olive, say "Esta semana aún no tiene menú" and have the primary button "Elegir menú para esta semana" to `/planner?week=current`.

#### Scenario: A past week
- **WHEN** the user views a past week inside the window with no selection
- **THEN** the notice is grey, says "No se eligió menú para esta semana" and "Las semanas pasadas no se pueden cambiar.", and has no link or button

#### Scenario: This week, still open
- **WHEN** the user with no menu for this week and none for next week views this week
- **THEN** the notice is olive, says "Esta semana aún no tiene menú", and has a button "Elegir menú para esta semana" to `/planner?week=current`

### Requirement: A closed week

In this week, when next week already has a menu, the notice SHALL be grey, say "Esta semana no tiene menú" and name the menu of next week ("Menú 31"). It SHALL have the secondary button "Ver el menú de la semana que viene" to `/menu` on that week, and SHALL NOT offer to choose a menu for this week.

#### Scenario: This week, closed by next week's menu
- **WHEN** the user with no menu for this week, who chose menu 31 for next week, views this week
- **THEN** the notice is grey, says "Esta semana no tiene menú", names "Menú 31", and has a button "Ver el menú de la semana que viene" to `/menu?startsOn=<next Monday>`, and no button to choose a menu for this week

### Requirement: The next week without a menu

In next week, when it has no menu, the notice SHALL be olive, say "La semana que viene aún no tiene menú" and have the primary button "Elegir menú para el 12 oct", with the short date of that week's Monday, to `/planner?week=next`. Every link of the notice SHALL be built by the server from the week and the selections, never from a value of the request.

#### Scenario: Next week without a menu
- **WHEN** the user views next week, which starts on Monday 2026-10-12, with no selection
- **THEN** the notice is olive, says "La semana que viene aún no tiene menú", and has a button "Elegir menú para el 12 oct" to `/planner?week=next`

#### Scenario: The links come from the server
- **WHEN** the request carries a `startsOn` or any other parameter that is not a Monday of the window
- **THEN** no link of the notice contains a value of the request

### Requirement: The page has one maximum width

From 800 px, the content of `/menu` SHALL have the same maximum width and the same side margin as the header of the shell, and SHALL be centred in the page, with or without a menu. The notice of a week without a menu SHALL be at most 760 px wide and aligned to the left of that content.

#### Scenario: A wide screen without a menu
- **WHEN** a signed-in user opens `/menu` on a week without a menu on a 1920 px screen
- **THEN** the title and the notice start at the left edge of the header's content, not at the edge of the screen, and the notice is at most 760 px wide

#### Scenario: A wide screen with a menu
- **WHEN** a signed-in user opens `/menu` on a week with a menu on a 1920 px screen
- **THEN** the title and the day cards start and end at the edges of the header's content

### Requirement: From 800 px a dish opens its recipe in a modal panel

When the content is 800 px wide or wider, activating a dish with a recipe SHALL open its recipe in a modal panel ("The recipe panel is modal"). The panel SHALL be a dialog named after the dish, SHALL say the day and meal of the dish, and SHALL show the recipe as the card does. When it opens, the focus SHALL move into the panel. Activating another dish while the panel is open SHALL show that dish's recipe. The dish whose recipe is open SHALL be announced as expanded.

#### Scenario: Opening a recipe
- **WHEN** the user activates the dish "Lentejas" in Wednesday's lunch, whose recipe takes 45 minutes in total, with the ingredient "Lentejas" of 240 g and two preparation steps
- **THEN** a dialog named after "Lentejas" opens with "Miércoles · Comida", 45 minutes, "Lentejas" with "240 g" and the two steps numbered 1 and 2; the focus is inside the dialog and the dish is announced as expanded

#### Scenario: Opening another dish
- **WHEN** the panel shows one dish's recipe and the user activates another dish with a recipe
- **THEN** the panel shows the other dish's recipe, and only that dish is announced as expanded

### Requirement: The recipe panel is modal

The recipe panel SHALL be a modal dialog 400 px wide against the right edge of the window, below the 64 px header, over a dark backdrop that leaves the header clear, wherever the dish is. The page behind SHALL NOT scroll while it is open, and Escape, the panel's close button and a tap on the backdrop SHALL close it and give the focus back to the dish that opened it.

#### Scenario: The panel lies on the right wherever the dish is
- **WHEN** the user opens a dish in the left half of the page and then a dish in the right half
- **THEN** both recipes open in the same panel against the right edge of the window, over a dark backdrop

#### Scenario: Closing with the backdrop
- **WHEN** the panel is open and the user taps the backdrop
- **THEN** the panel closes and the page scrolls again

#### Scenario: Closing with Escape
- **WHEN** the panel is open and the user presses Escape
- **THEN** the panel closes and the focus returns to the dish that opened it, now announced as collapsed

#### Scenario: Closing with the close button
- **WHEN** the panel is open and the user activates "Cerrar receta"
- **THEN** the panel closes and the focus returns to the dish that opened it
