# menu-planner Specification

## Purpose
`/planner` (Buscar): a signed-in user searches the menus with free text, sees the five that fit best with the evidence for each, and chooses one for this week or next week, from a card or at random. The week selector shows what each week has and closes this week once next week is chosen.

## Requirements

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

### Requirement: Searching from a request

`/planner` SHALL offer a signed-in user a search box with the placeholder "¿Qué te apetece esta semana?". Sending it SHALL run one web search with the text of the request (spec `menu-search`, "Search from a request") and SHALL show, for that search only, the restriction chips of the request and the menus of its ranking, at most five, in ranking order. A new search SHALL replace the chips and menus of the previous one. The request text SHALL travel in the body of the request, never in the URL. The search SHALL work without JavaScript. The search box SHALL be a required field, so that the browser does not send it empty, with or without JavaScript. The box SHALL NOT cut the text the user types or pastes: the length of a request is checked on the server. While a search runs with JavaScript, the page SHALL say that it is searching, and the search button SHALL be disabled.

#### Scenario: Searching shows the chips and the top 5
- **WHEN** a signed-in user searches "garbanzos sin cerdo" and the search returns a structure with the constraints `garbanzos` and the exclusion `cerdo`, and the menus 12, 3, 20, 7 and 15 in that order
- **THEN** the page shows one chip for `garbanzos` and one for `cerdo`, and five cards ranked 1 to 5 for "Menú 12", "Menú 3", "Menú 20", "Menú 7" and "Menú 15"

#### Scenario: A new search replaces the previous one
- **WHEN** a signed-in user who searched "garbanzos" searches "lentejas"
- **THEN** the page shows only the chips and menus of "lentejas"

#### Scenario: The request text is not in the URL
- **WHEN** a signed-in user searches "garbanzos"
- **THEN** the URL of the page holds no part of the request text

#### Scenario: Searching without JavaScript
- **WHEN** a signed-in user with JavaScript disabled searches "garbanzos"
- **THEN** the page that comes back shows the chips and the menus of the search

#### Scenario: Searching in progress
- **WHEN** a signed-in user sends a search and its answer has not arrived
- **THEN** the page says it is searching and the search button is disabled

### Requirement: Restriction chips

The page SHALL show one chip per unit of the request: one for each constraint in no group, one for each `sameDish` group and one for each `anyOf` group, in the order of the first constraint of each unit. The chips SHALL be a list named "Lo que has pedido", and they SHALL be for guidance only: no chip SHALL be a control. Each member of a chip SHALL show its `term` exactly as the search returned it, with no word added. Each member SHALL carry an icon: a minus for an `exclude` constraint, a sparkles icon for an included `attribute`, and a plus for any other included constraint. The members of a `sameDish` chip SHALL be separated by a thin vertical rule, and the members of an `anyOf` chip by an "o". A chip SHALL be olive when all its members are `include`, terracotta when all are `exclude`, and ochre when it mixes both, and in a mixed chip each member SHALL keep the colour of its polarity. The border SHALL be solid when any member is hard and dashed when all are soft, and in a chip with both, each soft member SHALL be underlined with a dashed line. A member with a meal SHALL show "· comida" or "· cena" after it, once at the end when every member of the chip has the same meal. A long term SHALL wrap, never be cut. Each chip SHALL have a text for screen readers: "En el mismo plato: " for `sameDish` and "Una de: " for `anyOf`, then each member as "excluido: " for `exclude` or "atributo: " for an included `attribute`, the term, ", obligatorio" or ", preferencia", and ", en la comida" or ", en la cena", with the members joined by " y " for `sameDish` and " o " for `anyOf`. The icons and separators SHALL be hidden from screen readers.

#### Scenario: One literal constraint
- **WHEN** the structure has only the soft literal `garbanzos` with polarity `include`
- **THEN** one olive chip with a dashed border shows a plus and "garbanzos", and its screen reader text is "garbanzos, preferencia"

#### Scenario: An included attribute with a meal
- **WHEN** the structure has only the soft attribute `sencillas` with polarity `include` and meal `dinner`
- **THEN** one olive chip shows a sparkles icon, "sencillas" and "· cena", and its screen reader text is "atributo: sencillas, preferencia, en la cena"

#### Scenario: A hard exclusion
- **WHEN** the structure has only the hard exclusion `cerdo`
- **THEN** one terracotta chip with a solid border shows a minus and "cerdo", and its screen reader text is "excluido: cerdo, obligatorio"

#### Scenario: An excluded fuzzy constraint
- **WHEN** the structure has only the fuzzy constraint `fritos` with polarity `exclude`
- **THEN** its chip is terracotta and shows a minus

#### Scenario: A same-dish group with both polarities
- **WHEN** `arroz` (include) and the exclusion `marisco` are a `sameDish` group, and `pollo` (include) is in no group
- **THEN** two chips are shown: an ochre one with "arroz" (plus, olive) and "marisco" (minus, terracotta) separated by a vertical rule, read as "En el mismo plato: arroz, preferencia y excluido: marisco, preferencia", and an olive one with "pollo"

#### Scenario: An any-of group
- **WHEN** `lubina` and `dorada` are an `anyOf` group
- **THEN** one olive chip shows "lubina", an "o" and "dorada", read as "Una de: lubina, preferencia o dorada, preferencia"

#### Scenario: A group with a hard and a soft member
- **WHEN** a `sameDish` group has the hard `arroz` and the soft `verduras`
- **THEN** its border is solid and only "verduras" is underlined with a dashed line

#### Scenario: A group with one meal
- **WHEN** both members of a `sameDish` group have meal `dinner`
- **THEN** the chip shows "· cena" once, after the last member

#### Scenario: A group with different meals
- **WHEN** the members of a `sameDish` group have meals `lunch` and `dinner`
- **THEN** each member shows its own suffix

#### Scenario: The chips cannot be operated
- **WHEN** the chips are shown
- **THEN** none of them is a button, a link or an input, and none has a remove control

### Requirement: No menu fits

When the search gives a ranking with no menu, the page SHALL say "Ningún menú encaja con lo que has pedido." under the chips and SHALL show no card.

#### Scenario: No menu fits
- **WHEN** the search gives a structure and an empty ranking
- **THEN** the page shows the chips, says "Ningún menú encaja con lo que has pedido." and shows no card

### Requirement: Search messages

When a search gives no ranking, the page SHALL show one message for its outcome and no chips or cards, and the message SHALL be announced to screen readers:

| Outcome | Message |
|---|---|
| empty request | "Escribe qué te apetece." |
| request longer than 300 characters | "La petición es demasiado larga: como mucho 300 caracteres." |
| rejected request | "Eso no parece una petición de menús. Prueba a decir qué te apetece comer." |
| answer that does not validate, or nothing to search | "No he sabido entender la petición. Prueba a escribirla de otra forma." |
| daily limit reached | "Hoy ya no se pueden hacer más búsquedas. Vuelve a intentarlo mañana." |
| any failure of the system | "No se ha podido buscar. Inténtalo de nuevo." |

#### Scenario: Empty box
- **WHEN** a signed-in user sends the search with the box empty, with or without JavaScript
- **THEN** the browser does not send it: no request reaches the server and no breadcrumb is added

#### Scenario: Empty request
- **WHEN** a signed-in user sends a request of only spaces
- **THEN** the page says "Escribe qué te apetece." and no search runs

#### Scenario: Request too long
- **WHEN** a signed-in user sends a request of 301 characters
- **THEN** the page says "La petición es demasiado larga: como mucho 300 caracteres." and no search runs

#### Scenario: Rejected request
- **WHEN** the search returns a rejection
- **THEN** the page says "Eso no parece una petición de menús. Prueba a decir qué te apetece comer."

#### Scenario: Nothing to search
- **WHEN** the search returns `nothing-to-search` or `invalid-answer`
- **THEN** the page says "No he sabido entender la petición. Prueba a escribirla de otra forma."

#### Scenario: Daily limit reached
- **WHEN** the search returns `llm-limit-reached`
- **THEN** the page says "Hoy ya no se pueden hacer más búsquedas. Vuelve a intentarlo mañana."

#### Scenario: Failure of the system
- **WHEN** the search returns `decomposer-failed`, `embedding-failed`, `search-failed`, `index-not-loaded` or `invalid-request`
- **THEN** the page says "No se ha podido buscar. Inténtalo de nuevo."

#### Scenario: A ranking that does not match its request
- **WHEN** the search returns a unit with a constraint id the structure does not have, or a menu whose evidence does not have one item per unit
- **THEN** the page says "No se ha podido buscar. Inténtalo de nuevo." with the outcome `search-failed`, and shows no chips or cards

### Requirement: Searching needs a session and trusts only the session

The action behind the search box SHALL check the session before it reads the request. Without a valid session it SHALL run no search and SHALL send the request to `/login`. It SHALL read one field, the text of the request. A missing field, or a field that is not text, SHALL be treated as an empty request. Every other field SHALL be ignored.

#### Scenario: Searching without a session
- **WHEN** a request to the search action carries no valid session
- **THEN** no search runs, the daily LLM bucket is not hit, and the response sends the browser to `/login`

#### Scenario: A field that is not text
- **WHEN** a signed-in user posts the search action with a file in place of the request text, or with no request field
- **THEN** no search runs and the page says "Escribe qué te apetece."

#### Scenario: Extra fields are ignored
- **WHEN** a signed-in user posts the search action with the request "garbanzos" and extra fields naming another user and a strategy
- **THEN** the search runs once with "garbanzos" and the web's own strategy, and no other field reaches it

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
