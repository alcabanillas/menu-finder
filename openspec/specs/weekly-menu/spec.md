# weekly-menu Specification

## Purpose
`/menu` shows a signed-in user the menu they chose for this week, one day at a time, with the recipe of each dish as a card that unfolds in place (UI-card-receta).

## Requirements

### Requirement: The page shows the active menu's week

`/menu` SHALL show to a signed-in user their active menu: the menu of their selection that starts on the Monday of the week that holds today, with "today" being the date in Europe/Madrid. The page SHALL have a heading "Menú N", with N the menu number, and above it "Semana del D de MES", with the Monday it starts on. When the content is narrower than 800 px, it SHALL show seven day tabs, Monday to Sunday, each with its weekday and the day of the month of that week. Today's tab SHALL carry a mark and SHALL be the selected tab when the page opens.

#### Scenario: The week of the active menu
- **WHEN** a signed-in user whose active menu is 3, from Monday 2026-10-05, opens `/menu` on Wednesday 2026-10-07 on a screen narrower than 800 px
- **THEN** the heading reads "Menú 3", the line above it reads "Semana del 5 de octubre", the tabs show the days 5 to 11, and the Wednesday 7 tab is marked as today and selected

#### Scenario: Next week's menu is not the active one
- **WHEN** a signed-in user whose only selection starts on the next Monday opens `/menu`
- **THEN** the page shows no menu and says there is no menu for this week

### Requirement: The selected day shows its dishes

When the content is narrower than 800 px, the page SHALL show the selected day as its weekday and date, written in Spanish ("Miércoles 7 de octubre"), and its dishes under "Comida" and "Cena", in the menu's order. Selecting another tab SHALL show that day. The tabs SHALL behave as a tab list for assistive technology: one tab selected at a time, and the arrow keys move between tabs. A day with no dishes SHALL say "El menú no incluye platos para este día" instead of the meals. Without JavaScript, the page SHALL show today's day.

#### Scenario: Today's dishes
- **WHEN** the page opens on Wednesday and the menu has two dishes for Wednesday's lunch and one for its dinner
- **THEN** the page shows "Miércoles 7 de octubre", the two dishes under "Comida" and the one under "Cena", in the menu's order

#### Scenario: Selecting another day
- **WHEN** the user selects the Monday tab
- **THEN** the Monday tab is the only one selected and the page shows Monday's dishes

#### Scenario: Moving with the keyboard
- **WHEN** the Wednesday tab has the focus and the user presses the right arrow
- **THEN** the Thursday tab gets the focus and is selected

#### Scenario: A day with no dishes
- **WHEN** the user selects a day for which the menu has no dishes
- **THEN** the page says "El menú no incluye platos para este día" and shows no "Comida" or "Cena"

#### Scenario: Without JavaScript
- **WHEN** a signed-in user with JavaScript disabled opens `/menu` on a screen narrower than 800 px
- **THEN** the page shows today's dishes

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

When the user has no active menu, the page SHALL have the heading "Menú", SHALL say that there is no menu for this week, and SHALL link to `/planner` to choose one. When the menu cannot be read, the page SHALL have the heading "Menú" and SHALL say that the menu could not be loaded, without any detail of the failure.

#### Scenario: No menu chosen for this week
- **WHEN** a signed-in user with no active menu opens `/menu`
- **THEN** the page says there is no menu for this week and has a link to `/planner`

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

### Requirement: From 800 px the page shows the whole week

When the content is 800 px wide or wider, the page SHALL show the active menu's week as a table instead of the day tabs: one column per day, Monday to Saturday, and Sunday only when the menu has dishes for it; each column headed by its weekday and its date ("7 oct"); one row for "Comida" and one for "Cena", with the dishes of each meal in the menu's order. Today's column SHALL be highlighted and its header SHALL say "hoy" in text, not only by colour. A meal with no dishes SHALL show a dash. A dish with a recipe SHALL be a control that opens its recipe; a dish without one SHALL be plain text. Without JavaScript, the table SHALL still show every day's dishes.

#### Scenario: The week as a table
- **WHEN** a signed-in user whose active menu is 3, from Monday 2026-10-05, with dishes on every day, opens `/menu` on Wednesday 2026-10-07 on a screen 800 px wide or wider
- **THEN** the page shows a table with the columns Lunes 5 oct to Domingo 11 oct, the rows "Comida" and "Cena" with each day's dishes, and the Wednesday column highlighted with "hoy" in its header, and no day tabs

#### Scenario: Sunday without dishes is left out
- **WHEN** the menu has no dishes for Sunday
- **THEN** the table has six columns, Monday to Saturday

#### Scenario: A meal with no dishes
- **WHEN** a day has dishes for lunch but none for dinner
- **THEN** that day's "Cena" cell shows a dash

#### Scenario: Dishes with and without a recipe
- **WHEN** a cell holds a dish with a recipe and one without
- **THEN** the first is a control that opens a dialog, and the second is plain text

### Requirement: From 800 px a dish opens its recipe in a panel

When the content is 800 px wide or wider, activating a dish with a recipe SHALL open a panel beside the table, over the half of the table opposite the dish's column. The panel SHALL be a dialog named after the dish, SHALL say the day and meal of the dish, and SHALL show the recipe as the card does: the times with a dash when unknown, the ingredients with their amounts and "opcional", and the numbered steps. When it opens, the focus SHALL move into the panel. Escape and the panel's close button SHALL close it and give the focus back to the dish that opened it. Activating another dish while the panel is open SHALL show that dish's recipe. The dish whose recipe is open SHALL be announced as expanded.

#### Scenario: Opening a recipe
- **WHEN** the user activates the dish "Lentejas" in Wednesday's lunch, whose recipe takes 45 minutes in total, with the ingredient "Lentejas" of 240 g and two preparation steps
- **THEN** a dialog named after "Lentejas" opens with "Miércoles · Comida", 45 minutes, "Lentejas" with "240 g" and the two steps numbered 1 and 2; the focus is inside the dialog and the dish is announced as expanded

#### Scenario: The panel takes the side away from the dish
- **WHEN** the user opens a dish of Monday and then a dish of Saturday
- **THEN** the panel of Monday's dish lies over the right half of the table and the panel of Saturday's dish over the left half

#### Scenario: Closing with Escape
- **WHEN** the panel is open and the user presses Escape
- **THEN** the panel closes and the focus returns to the dish that opened it, now announced as collapsed

#### Scenario: Closing with the close button
- **WHEN** the panel is open and the user activates "Cerrar receta"
- **THEN** the panel closes and the focus returns to the dish that opened it

#### Scenario: Opening another dish
- **WHEN** the panel shows one dish's recipe and the user activates another dish with a recipe
- **THEN** the panel shows the other dish's recipe, and only that dish is announced as expanded
