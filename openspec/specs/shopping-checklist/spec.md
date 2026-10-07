# shopping-checklist Specification

## Purpose

Lets a signed-in user see the shopping list of their current selection as a checklist grouped by category and tick items off as they shop, with the ticks stored per selection in the database (UI-flujo-semanal, ING-lista-compra).

## Requirements

### Requirement: The page shows the current shopping list

`/shopping-list` SHALL show the shopping list of the user's current shopping list selection, as defined by the `menu-selection` capability. It SHALL show the menu number and the Monday the selection starts on, and every item of that menu's list grouped by category. The categories SHALL appear in the order of their first item in the list, and the items in the order of the list. Each item SHALL show its name, its quantity with its unit when it has one, and the mark "opcional" when it is optional. The page SHALL show only data of the session's user.

#### Scenario: A current list with items
- **WHEN** a user whose current shopping list is menu 9101 from 2026-10-05, with items "Garbanzos cocidos" (400 g, Legumbres) and "Piñones" (20 g, optional, Legumbres) and "Leche" (1000 ml, Lácteos), opens `/shopping-list`
- **THEN** the page shows "Menú 9101", the Monday 5 October, the category "Legumbres" with "Garbanzos cocidos" 400 g and "Piñones" 20 g marked "opcional", and then the category "Lácteos" with "Leche" 1000 ml

#### Scenario: An item without quantity
- **WHEN** the current list has the item "Comino" in "Especias", with no quantity and no unit
- **THEN** the row shows "Comino" and no amount

#### Scenario: Next week's list is the current one
- **WHEN** on Friday 2026-10-09 a user has menu 3 from 2026-10-05 and menu 12 from 2026-10-12
- **THEN** `/shopping-list` shows the list of menu 12

#### Scenario: No current shopping list
- **WHEN** a user with no current shopping list opens `/shopping-list`
- **THEN** the page says there is no menu chosen and links to `/planner`, and shows no items

#### Scenario: The menu has no stored list
- **WHEN** the current selection's menu has no shopping items stored
- **THEN** the page says the list of that menu is not available, and shows no items

#### Scenario: The list cannot be read
- **WHEN** reading the selections, the items or the ticks fails
- **THEN** the page says the list could not be loaded, and shows no items

#### Scenario: Without a session
- **WHEN** a request for `/shopping-list` has no valid session
- **THEN** it goes to `/login` and nothing is read

### Requirement: A ticked item stays ticked

A user SHALL be able to tick and untick each item of the current shopping list. The tick SHALL be stored for the current selection on the server, so it SHALL be the same after a reload and from another browser. The page SHALL show a ticked item as ticked and the count of ticked items over all the items ("N de M").

#### Scenario: Ticking an item
- **WHEN** a user ticks "Garbanzos cocidos" in their current list and reloads the page
- **THEN** "Garbanzos cocidos" is shown ticked and the progress says "1 de 3"

#### Scenario: Unticking an item
- **WHEN** a user unticks a ticked item and reloads the page
- **THEN** the item is shown unticked and the progress counts one less

#### Scenario: Ticking without JavaScript
- **WHEN** a user with JavaScript disabled ticks an item
- **THEN** the page reloads with the item ticked

#### Scenario: Ticking twice is the same as ticking once
- **WHEN** a user ticks an item that is already ticked
- **THEN** the item stays ticked and the progress does not change

### Requirement: Ticking every item of a category

Each category SHALL offer one control that ticks all its items when not all of them are ticked, and unticks all of them when they all are. The control SHALL show how many of the category's items are ticked.

#### Scenario: Ticking a category
- **WHEN** a user with one of the two items of "Legumbres" ticked uses the category's control
- **THEN** both items of "Legumbres" are ticked, the control shows "2/2", and no item of another category changes

#### Scenario: Unticking a category
- **WHEN** a user with every item of "Legumbres" ticked uses the category's control
- **THEN** no item of "Legumbres" is ticked

### Requirement: Hiding the ticked items

The page SHALL offer two views, "Todo" and "Por comprar". "Por comprar" SHALL hide the ticked items and any category whose items are all ticked. The view SHALL be part of the address, so it survives a reload and works without JavaScript. Any other value SHALL show "Todo". The progress SHALL count every item in both views.

#### Scenario: Only what is left to buy
- **WHEN** a user with "Garbanzos cocidos" ticked opens the view "Por comprar"
- **THEN** "Garbanzos cocidos" is not shown, "Piñones" and "Leche" are, and the progress still says "1 de 3"

#### Scenario: An unknown view
- **WHEN** a user opens `/shopping-list` with an unknown view value
- **THEN** every item is shown

### Requirement: Ticks belong to the selection

Ticks SHALL belong to one selection. Choosing a menu again for another week SHALL start with no item ticked, even when it is the same menu. When a selection is replaced (`menu-selection`: choosing again for the same Monday), its ticks SHALL no longer exist. Loading the shopping lists again with the ingestion command SHALL keep the ticks, since the positions of the items do not change for the same PDF.

#### Scenario: The same menu another week
- **WHEN** a user ticked items of menu 12 from 2026-10-05 and, on 2026-10-09, chooses menu 12 for 2026-10-12, which becomes the current list
- **THEN** `/shopping-list` shows menu 12 with no item ticked

#### Scenario: Replacing next week's menu drops its ticks
- **WHEN** a user ticked items of the current list of menu 12 from 2026-10-12 and replaces it with menu 20
- **THEN** the current list is menu 20 with no item ticked, and the ticks of the replaced selection no longer exist

#### Scenario: Re-loading the shopping lists
- **WHEN** a user has ticked the item in position 2 of their current list and the shopping lists are loaded again
- **THEN** the item in position 2 is still ticked

### Requirement: Ticking is checked on the server

Ticking SHALL be done by a server-side action that checks the session before anything else. Without a valid session it SHALL store nothing and SHALL send the user to `/login`. The user SHALL be the session's user and the selection SHALL be that user's current shopping list; any field of the request naming a user or a selection SHALL be ignored.

#### Scenario: Ticking without a session
- **WHEN** the tick action is posted without a valid session
- **THEN** nothing is stored and the response goes to `/login`

#### Scenario: Fields naming another user are ignored
- **WHEN** user B posts a tick with extra fields naming user A and user A's selection
- **THEN** the tick is stored only for user B's current list, and user A's ticks are unchanged

#### Scenario: Another user's ticks are invisible
- **WHEN** user A ticked items of menu 12 and user B, whose current list is also menu 12, opens `/shopping-list`
- **THEN** user B sees no item ticked

### Requirement: The tick input is validated

The action SHALL accept only positions that are positive integers and belong to an item of the current list, a tick value of `true` or `false`, and a menu number equal to the current list's menu. When any of them fails, it SHALL store nothing and SHALL say why: an invalid request, or a list that changed and must be reloaded. A request with no user's current list SHALL store nothing.

#### Scenario: A position that is not a positive integer
- **WHEN** the action receives the position `"2abc"`, `0`, `-1`, `1.5` or no position
- **THEN** nothing is stored and the request is refused as invalid

#### Scenario: A position outside the list
- **WHEN** the current list has 3 items and the action receives position 4
- **THEN** nothing is stored and the request is refused as invalid

#### Scenario: A tick value that is not a boolean
- **WHEN** the action receives the tick value `"yes"` or no tick value
- **THEN** nothing is stored and the request is refused as invalid

#### Scenario: The list changed while the page was open
- **WHEN** the page was drawn for menu 12, the user then chose menu 20 for the same Monday in another tab, and ticks an item on the old page
- **THEN** nothing is stored and the page says the list changed and must be reloaded

#### Scenario: No current list
- **WHEN** a user with no current shopping list posts a tick
- **THEN** nothing is stored and the request is refused as a changed list
