## ADDED Requirements

### Requirement: Choosing a menu from the ranking for the selected week

Each card SHALL have a button that chooses its menu for the week selected under "Eligiendo menú para": "Elegir para el <D mmm>" when that week has no menu, and "Cambiar el menú del <D mmm>", secondary, when it has one. Activating it SHALL choose that menu for that week with the rules of `menu-selection`. The selector SHALL then show the menu in its week and say "Menú N para la semana del <D mmm>." with a "Ver semana" link to `/menu` on that week. It SHALL work without JavaScript.

#### Scenario: Choosing for an empty week
- **WHEN** on Wednesday 2026-10-07 a signed-in user with no selections searches, keeps "Esta semana" selected, and activates "Elegir para el 5 oct" on the card of menu 22
- **THEN** menu 22 is stored from 2026-10-05, "Esta semana" shows "Menú 22", and the page says "Menú 22 para la semana del 5 oct." with a "Ver semana" link to `/menu?startsOn=2026-10-05`

#### Scenario: Choosing for next week
- **WHEN** the same user selects "La que viene" and activates "Elegir para el 12 oct" on the card of menu 7
- **THEN** menu 7 is stored from 2026-10-12, and the page says "Menú 7 para la semana del 12 oct." with a "Ver semana" link to `/menu?startsOn=2026-10-12`

#### Scenario: Replacing a week's menu
- **WHEN** a signed-in user whose only selection is menu 14 from 2026-10-05 selects "Esta semana" on Wednesday 2026-10-07
- **THEN** the cards other than menu 14 read "Cambiar el menú del 5 oct" as a secondary button

#### Scenario: Confirming the replacement in the card
- **WHEN** the same user activates "Cambiar el menú del 5 oct" on the card of menu 22
- **THEN** the buttons of that card give way to an ochre box that says "¿Cambiar el Menú 14 por el Menú 22 en la semana del 5 oct?" with the buttons "Cambiar" and "Cancelar", the other cards keep their buttons, and nothing is stored yet; "Cambiar" stores menu 22 from 2026-10-05 in place of menu 14, and "Cancelar" brings the buttons back

#### Scenario: Another week closes the question
- **WHEN** the question is open and the user selects another week
- **THEN** the question is closed and nothing is stored

#### Scenario: The buttons follow the selected week
- **WHEN** a signed-in user with menu 14 this week and no menu next week switches the selector from "La que viene" to "Esta semana"
- **THEN** the buttons change from "Elegir para el 12 oct" to "Cambiar el menú del 5 oct", and no new search runs

#### Scenario: Choosing without JavaScript
- **WHEN** a signed-in user with JavaScript disabled selects "La que viene" and activates the button of a card
- **THEN** the menu is stored for next week, and the page that comes back shows the selector with the message and its "Ver semana" link

### Requirement: The card of the week's menu

The card whose menu is the menu of the selected week SHALL read "Menú del <D mmm>" with a check instead of its choose button, SHALL have that button disabled, and SHALL have an olive double border. Every other card SHALL keep its choose button.

#### Scenario: The week's menu among the cards
- **WHEN** "Esta semana" has menu 14 and is selected, and menu 14 is among the cards
- **THEN** the card of menu 14 reads "Menú del 5 oct", disabled, with the olive border, and the other cards read "Cambiar el menú del 5 oct"

#### Scenario: Another week selected
- **WHEN** the user then selects "La que viene", which has no menu
- **THEN** the card of menu 14 reads "Elegir para el 12 oct" like the others

### Requirement: The results stay while choosing

With JavaScript, after a menu is chosen the page SHALL keep the chips and cards of the search, and the buttons SHALL follow the new menu of the week. While a choice runs, every choose button SHALL be disabled and the page SHALL say that it is choosing. A new search, or another week in the selector, SHALL remove the message of the choice.

#### Scenario: The results stay after choosing
- **WHEN** a signed-in user who searched and got five cards chooses the menu of the second card for an empty week
- **THEN** the five cards and the chips are still shown, the second card reads "Menú del <D mmm>", and the other four read "Cambiar el menú del <D mmm>"

#### Scenario: Choosing in progress
- **WHEN** a signed-in user activates a choose button and the answer has not arrived
- **THEN** every choose button is disabled and the page says "Eligiendo…"

#### Scenario: A new search clears the message
- **WHEN** a user who chose a menu sends a new search
- **THEN** the page no longer shows the message of the choice

#### Scenario: Another week clears the message
- **WHEN** a user who chose a menu for "Esta semana" selects "La que viene"
- **THEN** the page no longer shows the message of the choice

### Requirement: Choosing messages

When choosing gives no selection, the page SHALL keep the results, SHALL store nothing, and SHALL show one message for the outcome, announced to screen readers:

| Outcome | Message |
|---|---|
| invalid or unknown menu | "Ese menú no existe." |
| invalid week | "Esa semana no se puede elegir." |
| locked week | "Esta semana ya no se puede cambiar: ya has elegido la de la semana que viene." |
| any failure of the system | "No se ha podido elegir el menú. Inténtalo de nuevo." |

#### Scenario: A menu that does not exist
- **WHEN** the choice is refused as an unknown menu
- **THEN** no selection is stored and the page says "Ese menú no existe."

#### Scenario: A locked week
- **WHEN** the choice is refused as a locked week
- **THEN** no selection is stored and the page says "Esta semana ya no se puede cambiar: ya has elegido la de la semana que viene."

#### Scenario: The database fails
- **WHEN** storing the selection fails
- **THEN** no selection is stored and the page says "No se ha podido elegir el menú. Inténtalo de nuevo."

### Requirement: Choosing needs a session and trusts only the session, the menu and the week

The action behind the choose buttons SHALL check the session before it reads the request. Without a valid session it SHALL store nothing and SHALL send the request to `/login`. The user of the selection SHALL be the user of the session. The action SHALL read two fields, the menu number and the week, validated with the rules of `menu-selection`. Every other field SHALL be ignored.

#### Scenario: Choosing without a session
- **WHEN** a request to the choose action carries no valid session
- **THEN** no selection is stored and the response sends the browser to `/login`

#### Scenario: A menu number that is not valid
- **WHEN** a signed-in user posts the choose action for this week with the menu `"12abc"`, `0`, `-3`, `1.5`, a file or no menu field
- **THEN** no selection is stored and the page says "Ese menú no existe."

#### Scenario: A week that is not valid
- **WHEN** a signed-in user posts the choose action with menu 12 and the week `"2026-10-19"`, a file or no week field
- **THEN** no selection is stored and the page says "Esa semana no se puede elegir."

#### Scenario: A forged choice for a locked week
- **WHEN** a signed-in user with a menu next week posts the choose action with menu 12 and the week `current`
- **THEN** no selection is stored and the page says "Esta semana ya no se puede cambiar: ya has elegido la de la semana que viene."

#### Scenario: Fields in the request are ignored
- **WHEN** a signed-in user A posts the choose action with menu 12, the week `next`, and extra fields naming user B and the start date 2026-12-28
- **THEN** menu 12 is chosen for user A from next Monday, and user B has no new selection

#### Scenario: A menu outside the ranking
- **WHEN** a signed-in user posts the choose action with a stored menu that was not among the cards
- **THEN** that menu is chosen for the user, as any stored menu can be

### Requirement: Candidate cards with evidence and a choose button

Each menu of the ranking SHALL be shown as a card with its rank, "Menú N" and one evidence line per unit of the request, in the order of the chips. An evidence line SHALL name the terms of its unit and, when the search gave a dish for it, the day, the meal and the name of that dish, as "Martes, comida · <dish name>". A unit with no dish SHALL say "no aparece en la semana" when all its members are `exclude`, and "ningún plato" otherwise, with a cross instead of a check. The terms of a line SHALL be olive for an `include` member, an included `attribute` among them, and terracotta for an `exclude` member, and an `exclude` member SHALL also carry a minus, so that the polarity is not told by colour alone. A long term SHALL wrap, never be cut or overflow the card. Each line SHALL have a text for screen readers: the text of its chip ("Restriction chips"), ": " and its detail; its terms, icons and separators SHALL be hidden from screen readers. The cards SHALL have no title and no explanation. Their only button SHALL be the choose button ("Choosing a menu from the ranking for the selected week"), whose accessible name SHALL start with its visible text and also name the menu. When the weeks cannot be read, the cards SHALL have no button.

#### Scenario: A unit covered by a dish
- **WHEN** the unit of `garbanzos` has as evidence the lunch dish "Garbanzos con espinacas" of Tuesday
- **THEN** the card shows a check, "garbanzos" and "Martes, comida · Garbanzos con espinacas"

#### Scenario: A week-wide exclusion
- **WHEN** the unit of the exclusion `cerdo`, in no group, has no dish
- **THEN** the card shows a check, "cerdo" and "no aparece en la semana"

#### Scenario: A soft constraint no dish covers
- **WHEN** the unit of the included `salmón` has no dish
- **THEN** the card shows a cross, "salmón" and "ningún plato"

#### Scenario: An evidence line read by a screen reader
- **WHEN** the `sameDish` unit of `arroz` and the exclusion `marisco` has as evidence the lunch dish "Arroz con verduras" of Tuesday
- **THEN** "marisco" shows a minus, and the screen reader text of the line is "En el mismo plato: arroz, preferencia y excluido: marisco, preferencia: Martes, comida · Arroz con verduras"

#### Scenario: The only action of a card is choosing it
- **WHEN** the cards are shown with "La que viene" selected and empty
- **THEN** no card has a title or an explanation, and each has one button, "Elegir para el 12 oct", whose accessible name starts with its visible text and names its menu, as "Elegir para el 12 oct (Menú 22)"

#### Scenario: No buttons without the weeks
- **WHEN** the weeks of the user cannot be read
- **THEN** the cards are shown with no button

## MODIFIED Requirements

### Requirement: The planner shows the week's selections

`/planner` SHALL have no visible title and no greeting, only a heading "Buscar menú" for screen readers. It SHALL show, under "Eligiendo menú para", this week and next week as the two options of one choice, "Esta semana" and "La que viene", each with its dates ("5 – 11 oct") and its menu as "Menú N" or "Sin menú". The selected option SHALL start on the week `?week=current|next` asks for when that week is not locked, otherwise on the week `menu-selection` suggests, and it SHALL have a 2 px olive border on an olive background. When this week is locked, "Esta semana" SHALL be disabled, with a dashed border, grey text and, inside its card, a padlock and "Cerrada". When the selected week has a menu, its card SHALL say "Si eliges otro, lo sustituye" with a repeat icon, in ochre. Under the options, the page SHALL say "El menú que elijas irá a la semana del <D mmm>." only when the selected week is empty. Changing the option SHALL NOT run a search. The search box SHALL read "¿Qué te apetece?", and the selector and the search row SHALL have the same maximum width.

#### Scenario: Nothing chosen
- **WHEN** on Wednesday 2026-10-07 a signed-in user with no selections opens `/planner`
- **THEN** "Esta semana" (5 – 11 oct) and "La que viene" (12 – 18 oct) both read "Sin menú", "Esta semana" is selected, and the page says "El menú que elijas irá a la semana del 5 oct."

#### Scenario: This week chosen
- **WHEN** on Wednesday 2026-10-07 a signed-in user whose only selection is menu 14 from 2026-10-05 opens `/planner`
- **THEN** "Esta semana" reads "Menú 14", "La que viene" reads "Sin menú" and is selected, and the page says "El menú que elijas irá a la semana del 12 oct."

#### Scenario: This week and next week chosen
- **WHEN** on Wednesday 2026-10-07 a signed-in user with menu 3 from 2026-10-05 and menu 12 from 2026-10-12 opens `/planner`
- **THEN** "Esta semana" reads "Menú 3", is disabled and says "Cerrada"; "La que viene" reads "Menú 12", is selected and says "Si eliges otro, lo sustituye"; no line is drawn under the options

#### Scenario: Selecting a week with a menu
- **WHEN** a signed-in user with menu 14 this week and nothing next week selects "Esta semana"
- **THEN** the card of "Esta semana" says "Si eliges otro, lo sustituye", no line is drawn under the options, and no search runs

#### Scenario: Buscar opened on a week
- **WHEN** a signed-in user opens `/planner?week=next`, and next week is empty
- **THEN** "La que viene" is selected; and `?week=2026-10-19`, or a locked week, is ignored

#### Scenario: The selections cannot be read
- **WHEN** reading the user's selections fails
- **THEN** the page says "No se ha podido cargar tu menú." in place of the options, and still shows the search box

### Requirement: Choosing a random menu

"Elegir uno al azar" SHALL be a secondary button with a dice icon, under the search box on a phone and to its right, in the same row, from an 800 px container. Activating it SHALL pick one of the stored menus at random on the server and choose it for the signed-in user, for the week selected under "Eligiendo menú para", with the rules of `menu-selection`. When that week has a menu, with JavaScript the page SHALL first ask, under the options, "¿Cambiar el Menú N por uno al azar en la semana del <D mmm>?" with "Cambiar" and "Cancelar". The selector SHALL then say "Menú N para la semana del <D mmm>." with its "Ver semana" link and show the updated weeks. It SHALL work without JavaScript.

#### Scenario: Choosing a random menu
- **WHEN** menus 3, 12 and 20 are stored, the random pick falls on 12, and a signed-in user with no selections activates the button on Monday 2026-10-05
- **THEN** menu 12 is stored from 2026-10-05 and the page says "Menú 12 para la semana del 5 oct."

#### Scenario: A random menu for next week
- **WHEN** a signed-in user whose only selection is menu 12 from 2026-10-12 selects "La que viene" and activates the button, then "Cambiar", on Wednesday 2026-10-07
- **THEN** the random menu is stored from 2026-10-12 in place of menu 12, and this week stays empty

#### Scenario: Asking before replacing
- **WHEN** a signed-in user with menu 14 this week selects "Esta semana" and activates the button
- **THEN** the page asks "¿Cambiar el Menú 14 por uno al azar en la semana del 5 oct?" and stores nothing until "Cambiar"; "Cancelar" closes the question

#### Scenario: A random menu for a locked week
- **WHEN** a request for "current" reaches the server while next week has a menu
- **THEN** nothing is stored and the page says this week can no longer be changed

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

## REMOVED Requirements

### Requirement: Candidate cards with evidence
**Reason**: The cards gain their one action, the choose button, so the scenario "Cards have no actions" no longer holds. The requirement is replaced whole, with the same evidence rules.
**Migration**: "Candidate cards with evidence and a choose button".

### Requirement: Choosing needs a session and trusts only the session
**Reason**: The random button is now one more submit of the choose form and sends the week, so the action reads fields of the request. The requirement is replaced whole by "Choosing needs a session and trusts only the session, the menu and the week".
**Migration**: "Choosing needs a session and trusts only the session, the menu and the week".
