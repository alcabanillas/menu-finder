## MODIFIED Requirements

### Requirement: The page without a menu to show

When the user has no active menu, the page SHALL have the heading "Semana sin menú" and SHALL show the notice of the week (see "A week without a menu says what the user can do"). When the menu cannot be read, the page SHALL have the heading "Menú" and SHALL say that the menu could not be loaded, without any detail of the failure.

#### Scenario: No menu chosen for this week
- **WHEN** a signed-in user with no active menu opens `/menu`
- **THEN** the page has the heading "Semana sin menú" and a notice that says this week has no menu

#### Scenario: The menu cannot be read
- **WHEN** reading the user's selection, the menu or its recipes fails
- **THEN** the page says the menu could not be loaded and shows no detail of the error

### Requirement: A week without menu shows the empty state with a link to the planner

When the displayed week has no selection of the user, the page SHALL show only the notice of the week below its header: no dishes, no error and no placeholder for the days, Sunday included. The notice SHALL have `role="status"`. It is the same notice that the dashboard shows when this week has no menu.

#### Scenario: Empty week
- **WHEN** the user views a week inside the window with no selection
- **THEN** the page shows one notice with `role="status"` and no card for any day of the week

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

## ADDED Requirements

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
