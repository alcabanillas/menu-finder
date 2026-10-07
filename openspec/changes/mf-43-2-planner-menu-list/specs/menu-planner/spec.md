## Purpose

The provisional `/planner`: a signed-in user sees every weekly menu with its dishes, chooses one, and sees which week it is for. The search of MF-22 replaces it.

## ADDED Requirements

### Requirement: The planner lists every menu

`/planner` SHALL show, to a signed-in user, every stored menu in ascending number order. Each menu SHALL show its number and, folded until the user opens it, its dishes grouped by day from Monday to Sunday, lunch before dinner. Opening and closing a menu SHALL work without JavaScript.

#### Scenario: Menus in number order
- **WHEN** menus 2, 10 and 1 are stored and a signed-in user opens `/planner`
- **THEN** the page shows "Menú 1", "Menú 2" and "Menú 10", in that order, each with an "Elegir" control

#### Scenario: A menu's dishes, folded
- **WHEN** a signed-in user opens `/planner`
- **THEN** no dish is visible until the user opens a menu, and an open menu shows its dishes under each day, lunch before dinner

#### Scenario: No menus stored
- **WHEN** no menu is stored and a signed-in user opens `/planner`
- **THEN** the page says there are no menus to choose from and shows no "Elegir" control

### Requirement: The planner shows the week's selections

`/planner` SHALL show, above the list, the user's menu for this week and the menu for next week, each as its number and the Monday it starts on, or as not chosen. The menu of the current shopping list SHALL be marked as chosen in the list.

#### Scenario: Nothing chosen
- **WHEN** a signed-in user with no selections opens `/planner`
- **THEN** this week and next week both read as not chosen, and no menu in the list is marked

#### Scenario: This week and next week chosen
- **WHEN** a signed-in user whose active menu is 3 and whose menu from next Monday is 12 opens `/planner`
- **THEN** the summary shows menu 3 for this week and menu 12 from next Monday, and menu 12 is marked as chosen in the list

### Requirement: Choosing a menu from the planner

Activating "Elegir" on a menu SHALL choose it for the signed-in user with the rules of `menu-selection`, and the page SHALL then say which menu was chosen and the Monday it starts on, and show the updated summary. It SHALL work without JavaScript.

#### Scenario: Choosing a menu
- **WHEN** a signed-in user with no selections activates "Elegir" on menu 12
- **THEN** the page says that menu 12 starts on this week's Monday, written as a Spanish date ("lunes 5 de octubre"), and the summary shows menu 12 for this week

#### Scenario: Choosing without JavaScript
- **WHEN** a signed-in user with JavaScript disabled activates "Elegir" on a menu
- **THEN** the selection is stored and the page shows it

### Requirement: Choosing needs a session and trusts only the session

The action behind "Elegir" SHALL check the session itself before reading the request. Without a valid session it SHALL store nothing and SHALL send the request to `/login`. The user of the selection SHALL be the user of the session; the request SHALL carry only the menu number, and any other field SHALL be ignored.

#### Scenario: Choosing without a session
- **WHEN** a request to the action of "Elegir" carries no valid session
- **THEN** no selection is stored and the response sends the browser to `/login`

#### Scenario: A user id in the request is ignored
- **WHEN** a signed-in user A posts "Elegir" with an extra field naming user B
- **THEN** the selection is stored for user A, and user B has no new selection

### Requirement: A refused choice is reported and stores nothing

When the choice is refused, the page SHALL show one message saying the menu could not be chosen, SHALL store nothing, and SHALL NOT echo the value it received. A failure of the system SHALL show a message asking to try again.

#### Scenario: A tampered menu number
- **WHEN** a signed-in user posts "Elegir" with the menu `"12abc"` or with menu 999, which does not exist
- **THEN** the page says the menu could not be chosen, does not show the posted value, and no selection is stored

#### Scenario: The database fails
- **WHEN** storing the selection fails
- **THEN** the page asks to try again and the summary is unchanged
