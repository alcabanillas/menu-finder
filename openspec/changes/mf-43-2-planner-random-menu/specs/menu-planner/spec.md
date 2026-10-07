## Purpose

The provisional `/planner`: a signed-in user gets a menu chosen at random and sees which weeks it covers. The search of MF-22 replaces it.

## ADDED Requirements

### Requirement: The planner shows the week's selections

`/planner` SHALL show to a signed-in user their menu for this week and their menu for next week, each as "Menú N" with the Monday it starts on written as a Spanish date ("lunes 5 de octubre"), or as "Sin elegir".

#### Scenario: Nothing chosen
- **WHEN** a signed-in user with no selections opens `/planner`
- **THEN** this week and next week both read "Sin elegir"

#### Scenario: This week and next week chosen
- **WHEN** a signed-in user whose active menu is 3, from Monday 2026-10-05, and whose menu from Monday 2026-10-12 is 12 opens `/planner`
- **THEN** this week reads "Menú 3" from "lunes 5 de octubre" and next week reads "Menú 12" from "lunes 12 de octubre"

#### Scenario: The selections cannot be read
- **WHEN** reading the user's selections fails
- **THEN** the page says the menu could not be loaded and still shows the button

### Requirement: Choosing a random menu

Activating "Elegir un menú al azar" SHALL pick one of the stored menus at random on the server and choose it for the signed-in user with the rules of `menu-selection`. The page SHALL then say which menu was chosen and the Monday it starts on, and show the updated summary. It SHALL work without JavaScript.

#### Scenario: Choosing a random menu
- **WHEN** menus 3, 12 and 20 are stored, the random pick falls on 12, and a signed-in user with no selections activates the button on Monday 2026-10-05
- **THEN** menu 12 is stored from 2026-10-05 and the page says "Te ha tocado el menú 12: empieza el lunes 5 de octubre."

#### Scenario: Every menu can be picked
- **WHEN** menus 3, 12 and 20 are stored and the random number is the lowest or the highest possible
- **THEN** the first or the last menu is picked, and never a number outside the stored ones

#### Scenario: Choosing without JavaScript
- **WHEN** a signed-in user with JavaScript disabled activates the button
- **THEN** a selection is stored and the page shows it

#### Scenario: No menus stored
- **WHEN** no menu is stored and a signed-in user activates the button
- **THEN** nothing is stored and the page says there are no menus to choose from

#### Scenario: The database fails
- **WHEN** reading the menus or storing the selection fails
- **THEN** nothing is stored and the page asks to try again

### Requirement: Choosing needs a session and trusts only the session

The action behind the button SHALL check the session before anything else. Without a valid session it SHALL store nothing and SHALL send the request to `/login`. The user of the selection SHALL be the user of the session; the action SHALL read no field of the request.

#### Scenario: Choosing without a session
- **WHEN** a request to the action carries no valid session
- **THEN** no selection is stored and the response sends the browser to `/login`

#### Scenario: Fields in the request are ignored
- **WHEN** a signed-in user A posts the action with extra fields naming user B and menu 999
- **THEN** a random stored menu is chosen for user A, and user B has no new selection
