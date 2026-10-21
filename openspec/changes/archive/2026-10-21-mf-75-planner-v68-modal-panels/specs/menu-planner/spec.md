## MODIFIED Requirements

### Requirement: Choosing a random menu

"Al azar" SHALL be a chip with a dice icon and an ink border, the first of the suggestions ("Suggestions to try"). Activating it SHALL pick one of the stored menus at random on the server and choose it for the signed-in user, for the week selected under "Eligiendo menú para", with the rules of `menu-selection`. When that week has a menu, with JavaScript the page SHALL first ask, under the options, "¿Cambiar el Menú N por uno al azar en la semana del <D mmm>?" with "Cambiar" and "Cancelar"; a new search or another week SHALL close it. The selector SHALL then say "Menú N para la semana del <D mmm>." with its "Ver semana" link and show the updated weeks. It SHALL work without JavaScript. The page SHALL have no other control to choose a random menu.

#### Scenario: Choosing a random menu
- **WHEN** menus 3, 12 and 20 are stored, the random pick falls on 12, and a signed-in user with no selections activates the chip "Al azar" on Monday 2026-10-05
- **THEN** menu 12 is stored from 2026-10-05 and the page says "Menú 12 para la semana del 5 oct."

#### Scenario: A random menu for next week
- **WHEN** a signed-in user whose only selection is menu 12 from 2026-10-12 selects "La que viene" and activates the chip, then "Cambiar", on Wednesday 2026-10-07
- **THEN** the random menu is stored from 2026-10-12 in place of menu 12, and this week stays empty

#### Scenario: Asking before replacing
- **WHEN** a signed-in user with menu 14 this week selects "Esta semana" and activates the chip "Al azar"
- **THEN** the page asks "¿Cambiar el Menú 14 por uno al azar en la semana del 5 oct?" and stores nothing until "Cambiar"; "Cancelar" closes the question

#### Scenario: A random menu for a locked week
- **WHEN** a request for "current" reaches the server while next week has a menu
- **THEN** nothing is stored and the page says this week can no longer be changed

#### Scenario: Every menu can be picked
- **WHEN** menus 3, 12 and 20 are stored and the random number is the lowest or the highest possible
- **THEN** the first or the last menu is picked, and never a number outside the stored ones

#### Scenario: Choosing without JavaScript
- **WHEN** a signed-in user with JavaScript disabled activates the chip "Al azar"
- **THEN** a selection is stored and the page shows it

#### Scenario: No menus stored
- **WHEN** no menu is stored and a signed-in user activates the chip
- **THEN** nothing is stored and the page says there are no menus to choose from

#### Scenario: The database fails
- **WHEN** reading the menus or storing the selection fails
- **THEN** nothing is stored and the page asks to try again

#### Scenario: No loose random button
- **WHEN** the planner is shown at 390 px or at 1280 px, with or without results
- **THEN** no button reads "Elegir uno al azar"

### Requirement: Searching from a request

`/planner` SHALL offer a signed-in user a search box with the placeholder "¿Qué te apetece?" until a search is sent, and "Busca otra cosa…" from then on. Sending it SHALL run one web search with the text of the request (spec `menu-search`, "Search from a request") and SHALL show, for that search only, the restriction chips of the request and the menus of its ranking, at most five, in ranking order. A new search SHALL replace the chips and menus of the previous one, and SHALL close any open confirmation question, from a card or from "Al azar", and the message of the last choice. The request text SHALL travel in the body of the request, never in the URL. The search SHALL work without JavaScript. The search box SHALL be a required field, so that the browser does not send it empty, with or without JavaScript. The box SHALL NOT cut the text the user types or pastes: the length of a request is checked on the server. While a search runs with JavaScript, the page SHALL say that it is searching, and the search button SHALL be disabled.

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

#### Scenario: The placeholder after a search
- **WHEN** a signed-in user opens `/planner` and then searches "garbanzos"
- **THEN** the box reads "¿Qué te apetece?" before the search and "Busca otra cosa…" after it, and its accessible name stays "Qué te apetece"

#### Scenario: A new search closes the question of "Al azar"
- **WHEN** a signed-in user with menu 14 this week activates "Al azar", so that the page asks "¿Cambiar el Menú 14 por uno al azar en la semana del 5 oct?", and then searches "lentejas"
- **THEN** the question is gone and nothing is stored

#### Scenario: A new search closes the question of a card
- **WHEN** the question of the card of menu 22 is open and the user searches again, and the new ranking has menu 22 too
- **THEN** the card of menu 22 shows its buttons, not the question, and nothing is stored

### Requirement: Choosing a menu from the ranking for the selected week

Each card SHALL have a button that chooses its menu for the week selected under "Eligiendo menú para": "Elegir para el <D mmm>" when that week has no menu, and "Cambiar el menú del <D mmm>", secondary, when it has one. Activating it SHALL choose that menu for that week with the rules of `menu-selection`. The selector SHALL then show the menu in its week and say "Menú N para la semana del <D mmm>." with a "Ver semana" link to `/menu` on that week. Only one confirmation question SHALL be open on the page: asking from another card SHALL close the one that was open, and so SHALL selecting another week or sending a new search. It SHALL work without JavaScript.

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

#### Scenario: One question at a time
- **WHEN** the question of the card of menu 22 is open and the user activates "Cambiar el menú del 5 oct" on the card of menu 7
- **THEN** the card of menu 22 shows its buttons again, only the card of menu 7 asks, and nothing is stored

#### Scenario: Another week closes the question
- **WHEN** the question is open and the user selects another week
- **THEN** the question is closed and nothing is stored

#### Scenario: The buttons follow the selected week
- **WHEN** a signed-in user with menu 14 this week and no menu next week switches the selector from "La que viene" to "Esta semana"
- **THEN** the buttons change from "Elegir para el 12 oct" to "Cambiar el menú del 5 oct", and no new search runs

#### Scenario: Choosing without JavaScript
- **WHEN** a signed-in user with JavaScript disabled selects "La que viene" and activates the button of a card
- **THEN** the menu is stored for next week, and the page that comes back shows the selector with the message and its "Ver semana" link

### Requirement: Results of a request with only exclusions

When every unit of the request is a week-wide exclusion and the ranking has a menu, the cards SHALL be preceded by "Todos cumplen lo que pides" above the heading "Resultados", followed by "Como solo has pedido quitar cosas, todos estos menús lo cumplen por igual: salen por número de menú.", and the cards SHALL have no rank and no summary sentence. That line SHALL be 14 px, in the muted text colour, at most 70 characters wide.

#### Scenario: Only week-wide exclusions
- **WHEN** a signed-in user searches "nada de cerdo" and the structure has only the ungrouped exclusion `cerdo`
- **THEN** the page shows "Todos cumplen lo que pides", "Resultados" and "Como solo has pedido quitar cosas, todos estos menús lo cumplen por igual: salen por número de menú.", and the cards show "Menú N" with no rank and no summary

#### Scenario: The type of the exclusions-only line
- **WHEN** the page shows "Como solo has pedido quitar cosas, todos estos menús lo cumplen por igual: salen por número de menú."
- **THEN** the line is 14 px, muted and at most 70 characters wide

### Requirement: Layout and closing of the week preview

Below 800 px the preview SHALL be a bottom sheet over a dark backdrop; from 800 px, a side panel 400 px wide against the right edge of the window, below the 64 px header, over a dark backdrop that leaves the header clear. On both sizes it SHALL be a modal dialog, and the page behind SHALL NOT scroll while it is open. Its body SHALL scroll inside it with a thin scroll bar, and its footer SHALL stay visible. Escape and ✕ SHALL close it, and so SHALL a tap on the backdrop. When it closes, the focus SHALL return to the "Ver semana" button of its card.

#### Scenario: A phone
- **WHEN** the preview opens at 390 px
- **THEN** it is a bottom sheet with a dark backdrop, and tapping the backdrop closes it

#### Scenario: A desktop
- **WHEN** the preview opens at 1280 px
- **THEN** it is a modal panel 400 px wide against the right edge of the window, below the header, over a dark backdrop that leaves the header clear, and tapping the backdrop closes it

#### Scenario: Closing the preview
- **WHEN** the preview is open and the user presses Escape or activates "Cerrar vista semanal"
- **THEN** it closes and the focus returns to the "Ver semana" button of that card

#### Scenario: A wide window
- **WHEN** the preview opens at 1920 px
- **THEN** its right side touches the right edge of the window, and the button of its footer is visible

#### Scenario: The page does not scroll behind the preview
- **WHEN** the preview is open at 390 px or at 1280 px and the user scrolls
- **THEN** only the body of the preview scrolls; when it closes, the page scrolls again
