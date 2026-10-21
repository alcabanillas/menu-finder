## MODIFIED Requirements

### Requirement: Choosing a random menu

"Al azar" SHALL be a chip with a dice icon and an ink border, the first of the suggestions ("Suggestions to try"). Activating it SHALL pick one of the stored menus at random on the server and choose it for the signed-in user, for the week selected under "Eligiendo menú para", with the rules of `menu-selection`. When that week has a menu, with JavaScript the page SHALL first ask, under the options, "¿Cambiar el Menú N por uno al azar en la semana del <D mmm>?" with "Cambiar" and "Cancelar". The selector SHALL then say "Menú N para la semana del <D mmm>." with its "Ver semana" link and show the updated weeks. It SHALL work without JavaScript. The page SHALL have no other control to choose a random menu.

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

### Requirement: No menu fits

When the search gives a ranking with no menu, the page SHALL show, under the chips, a panel with the heading "Ningún menú encaja con lo que has pedido", the sentence "Quita alguna condición o dila de otra forma.", the button "Editar mi búsqueda" ("Editing the last request"), the tip "Suele funcionar mejor decirlo corto: «cenas sin horno» mejor que «nada de horno por la noche».", and, under "O prueba con algo que suele funcionar", the suggestions of the page ("Suggestions to try"), "Al azar" first. The page SHALL show no card and no results heading.

#### Scenario: No menu fits
- **WHEN** the search gives a structure and an empty ranking
- **THEN** the page shows the chips and the heading "Ningún menú encaja con lo que has pedido", and shows no card

#### Scenario: Help under the heading
- **WHEN** the search gives an empty ranking
- **THEN** the panel also shows "Quita alguna condición o dila de otra forma.", "Editar mi búsqueda", the tip, "O prueba con algo que suele funcionar" and four suggestions led by "Al azar"

#### Scenario: A suggestion searches again
- **WHEN** the user activates a suggestion of the panel
- **THEN** the search runs with its text and replaces the panel

### Requirement: Candidate cards with evidence and a choose button

Each menu of the ranking SHALL be shown as a card with its rank, the heading "Menú N", a summary sentence and one evidence line per unit of the request, in the order of the chips. "Menú N" SHALL be the heading of the card, with no badge.

Each evidence line SHALL start with the state of its unit, from the evidence the search gave (spec `menu-search`, "Evidence of a unit"):

| Evidence | State | Detail |
|---|---|---|
| a `literal` dish | ✓, olive | "Martes, comida · <dish name>" |
| a `similar` dish | ≈, ochre | "parecido: Martes, comida · <dish name>" |
| no dish, all members `exclude` | ✓, olive | "no aparece en la semana" |
| no dish, any member `include` | ✕, terracotta | "ningún plato" |

A week-wide exclusion SHALL always read "no aparece en la semana", never that no dish holds it: its filter only looks for the word. After the state, the line SHALL name the terms of its unit: olive (`text-include`) for an `include` member, an included `attribute` among them, and terracotta (`text-exclude`) for an `exclude` member, which SHALL also carry a minus, so that the polarity is not told by colour alone; in a `sameDish` unit the members SHALL be separated by a thin vertical rule, and in an `anyOf` unit by an "o". A unit that mixes `include` and `exclude` SHALL have no background of its own: its terms are on the white of the card, each in the colour of its polarity. A long term SHALL wrap, never be cut or overflow the card.

The summary sentence SHALL be built only from the counts of the lines: a unit is met when its state is ✓ or ≈. With N units of which X are met and S are ≈, it SHALL read "Cumple las N cosas que pides." when X is N and N is more than one, "Cumple lo que pides." when N and X are one, and "Cumple X de las N cosas que pides." otherwise; when S is one or more, the final full stop SHALL give way to ", una con un plato parecido." for one or ", <S> con platos parecidos." for more, with S in words up to ten ("dos", "tres"). Every unit counts, the week-wide exclusions included.

Each line SHALL have a text for screen readers: the text of its chip ("Restriction chips"), ": " and its detail; its state, terms, icons and separators SHALL be hidden from screen readers. Their buttons SHALL be the choose button ("Choosing a menu from the ranking for the selected week"), whose accessible name SHALL start with its visible text and also name the menu, and "Ver semana" ("Week preview of a card"). When the weeks cannot be read, the cards SHALL have no choose button.

#### Scenario: A unit covered by a dish
- **WHEN** the unit of `garbanzos` has as evidence the `literal` lunch dish "Garbanzos con espinacas" of Tuesday
- **THEN** the card shows ✓, "garbanzos" and "Martes, comida · Garbanzos con espinacas"

#### Scenario: A unit covered by a similar dish
- **WHEN** the unit of `pescado al horno` has as evidence the `similar` dinner dish "Merluza en papillote" of Thursday
- **THEN** the card shows ≈ in ochre, "pescado al horno" and "parecido: Jueves, cena · Merluza en papillote", and its screen reader text is "pescado al horno, preferencia: parecido: Jueves, cena · Merluza en papillote"

#### Scenario: A week-wide exclusion
- **WHEN** the unit of the exclusion `cerdo`, in no group, has no dish
- **THEN** the card shows ✓, "cerdo" and "no aparece en la semana"

#### Scenario: A soft constraint no dish covers
- **WHEN** the unit of the included `salmón` has no dish
- **THEN** the card shows ✕, "salmón" and "ningún plato"

#### Scenario: Every unit met
- **WHEN** a card has the units `garbanzos` (literal), `pescado al horno` (similar) and the exclusion `cerdo`
- **THEN** its summary reads "Cumple las 3 cosas que pides, una con un plato parecido."

#### Scenario: Some units met
- **WHEN** a card has the units `garbanzos` (literal), `pescado al horno` (no dish) and the exclusion `cerdo`
- **THEN** its summary reads "Cumple 2 de las 3 cosas que pides."

#### Scenario: Two similar dishes
- **WHEN** a card has three units, two of them `similar` and one `literal`
- **THEN** its summary reads "Cumple las 3 cosas que pides, dos con platos parecidos."

#### Scenario: One unit
- **WHEN** the request has only `garbanzos` and the card's evidence is `literal`
- **THEN** its summary reads "Cumple lo que pides."

#### Scenario: An evidence line read by a screen reader
- **WHEN** the `sameDish` unit of `arroz` and the exclusion `marisco` has as evidence the `literal` lunch dish "Arroz con verduras" of Tuesday
- **THEN** "marisco" shows a minus, and the screen reader text of the line is "En el mismo plato: arroz, preferencia y excluido: marisco, preferencia: Martes, comida · Arroz con verduras"

#### Scenario: A mixed unit on white
- **WHEN** the `sameDish` unit of `arroz` and the exclusion `marisco` is shown in a card
- **THEN** "arroz" is olive and "marisco" is terracotta, and the unit has no ochre background

#### Scenario: The only action of a card is choosing it
- **WHEN** the cards are shown with "La que viene" selected and empty
- **THEN** each card has the heading "Menú N" and no badge, and two buttons: "Elegir para el 12 oct", whose accessible name starts with its visible text and names its menu, as "Elegir para el 12 oct (Menú 22)", and "Ver semana"

#### Scenario: No buttons without the weeks
- **WHEN** the weeks of the user cannot be read
- **THEN** the cards are shown with no choose button

#### Scenario: The summary says only what the lines say
- **WHEN** any card is shown
- **THEN** its summary is one of the fixed sentences of this requirement, with numbers equal to the counts of its lines, and holds no term, dish or other text

## ADDED Requirements

### Requirement: Suggestions to try

Until a search returns a ranking, the page SHALL show under the search box "Prueba con" and a row of chips: "Al azar" and four requests taken at random, on each load, from a fixed list of requests that return results. Activating a request SHALL run that search with its text, in the body of the request and never in the URL. The row SHALL be the same at every width and hidden while a search runs.

#### Scenario: Before searching
- **WHEN** a signed-in user opens `/planner`
- **THEN** the page shows "Prueba con", the chip "Al azar" first and four requests after it, and no loose random button

#### Scenario: A suggestion runs a search
- **WHEN** the user activates the suggestion "de cuchara"
- **THEN** the search runs with the text "de cuchara", the chips and menus of that search are shown, and the URL holds no part of the text

#### Scenario: A suggestion without JavaScript
- **WHEN** a signed-in user with JavaScript disabled activates a suggestion
- **THEN** the page that comes back shows the chips and the menus of that search

#### Scenario: The list gives results
- **WHEN** each request of the fixed list is searched
- **THEN** every one of them returns at least one menu

#### Scenario: The row goes after a search
- **WHEN** a search returns menus
- **THEN** "Prueba con" is no longer shown, and neither is "Al azar"

#### Scenario: The row stays after a failed search
- **WHEN** a search gives no ranking, for example because the daily limit is reached
- **THEN** the message of the failure is shown and "Prueba con" stays, with "Al azar"

### Requirement: Layout of the results

The chips of the request SHALL be a strip as wide as the content, with the label "Lo que has pedido", above the results; the results SHALL follow in one column and, from a 1100 px container, in two columns. The content of the page SHALL be aligned to the left. The search box and the selector SHALL keep their maximum width.

#### Scenario: Strip above the results
- **WHEN** a search returns menus at 1280 px
- **THEN** "Lo que has pedido" and its chips are above the heading "Resultados", across the width of the content, and no chip is in a side column

#### Scenario: One column on a narrow container
- **WHEN** the same search is shown in a container narrower than 1100 px
- **THEN** the cards are in one column

#### Scenario: Two columns on a wide container
- **WHEN** the same search is shown in a container of 1100 px or more
- **THEN** the cards are in two columns, in ranking order

### Requirement: Editing the last request

"Editar mi búsqueda" SHALL put in the search box the text of the last request exactly as the user wrote it, without trimming or changing it, SHALL focus the box with the cursor at its end, and SHALL NOT send anything. It SHALL be shown only when there is a last request, and it needs JavaScript.

#### Scenario: The request comes back as it was
- **WHEN** a search "  cenas sin horno  " gives no menu and the user activates "Editar mi búsqueda"
- **THEN** the box holds "  cenas sin horno  ", has the focus with the cursor at the end, and no search runs

#### Scenario: Nothing is rewritten
- **WHEN** the user activates the button twice
- **THEN** the box holds the same text both times

#### Scenario: Not shown without a request
- **WHEN** the no-results panel has no last request
- **THEN** it does not show "Editar mi búsqueda"

### Requirement: Week preview of a card

Each card SHALL have a secondary button "Ver semana" with a calendar icon, after the choose button, that opens a preview of the week of its menu without leaving `/planner` and without removing the chips or cards. While it is open, the button SHALL have `aria-expanded` true, an olive border and an olive background. Only one preview SHALL be open at a time.

#### Scenario: Opening the preview
- **WHEN** the user activates "Ver semana" on the card of menu 22, the second of the ranking
- **THEN** a dialog opens with "Candidato #2", "Menú 22" and the days of that menu, the button reads as open, and the chips and cards of the search are still shown

#### Scenario: Another card
- **WHEN** the preview of menu 22 is open and the user activates "Ver semana" on another card
- **THEN** the preview shows the other menu, with only one preview open

### Requirement: Content of the week preview

The preview SHALL have the eyebrow "Candidato #N" (the rank of the card, or "Vista previa" when the cards have no rank), the heading "Menú N" and a button ✕ named "Cerrar vista semanal". It SHALL list Monday to Saturday, and Sunday only with dishes, each day with its colour bar and the names of its lunch and dinner dishes, with no recipe and no date. A dish that is the evidence of a unit SHALL carry beside its name ✓ (olive) or ≈ (ochre) and the terms of the unit.

#### Scenario: Evidence dishes are marked
- **WHEN** the unit of `garbanzos` has the literal dish "Garbanzos con espinacas" on Monday lunch and the unit of `pescado` the similar dish "Merluza en papillote" on Thursday dinner
- **THEN** the preview shows "✓ garbanzos" beside the first dish and "≈ pescado" beside the second, and no mark beside the others

#### Scenario: A request with only exclusions
- **WHEN** the cards have no rank and the user opens a preview
- **THEN** the eyebrow reads "Vista previa"

#### Scenario: Sunday without dishes
- **WHEN** the menu has no dish on Sunday
- **THEN** the preview lists Monday to Saturday only

### Requirement: Layout and closing of the week preview

Below 800 px the preview SHALL be a bottom sheet over a dark backdrop; from 800 px, a side panel on the right, 400 px wide, below the 64 px header, with no backdrop, leaving the cards usable. Escape and ✕ SHALL close it, and so SHALL a tap on the backdrop. When it closes, the focus SHALL return to the "Ver semana" button of its card.

#### Scenario: A phone
- **WHEN** the preview opens at 390 px
- **THEN** it is a bottom sheet with a dark backdrop, and tapping the backdrop closes it

#### Scenario: A desktop
- **WHEN** the preview opens at 1280 px
- **THEN** it is a panel on the right, 400 px wide, below the header, with no backdrop, and the cards stay usable

#### Scenario: Closing the preview
- **WHEN** the preview is open and the user presses Escape or activates "Cerrar vista semanal"
- **THEN** it closes and the focus returns to the "Ver semana" button of that card

### Requirement: Choosing from the week preview

The preview SHALL have a fixed footer with the choose button of its card, with the same label, variant and rules as the card's ("Choosing a menu from the ranking for the selected week"). When the button replaces the menu of the week, its question SHALL be asked in the footer and not in the card.

#### Scenario: Choosing from the preview
- **WHEN** the preview of menu 22 is open, "La que viene" is selected and empty, and the user activates the button of its footer, "Elegir para el 12 oct"
- **THEN** menu 22 is chosen for that week as if the button of the card had been used

#### Scenario: Replacing from the preview
- **WHEN** the selected week has menu 14 and the user activates "Cambiar el menú del 5 oct" in the footer of the preview of menu 22
- **THEN** the footer shows the question "¿Cambiar el Menú 14 por el Menú 22 en la semana del 5 oct?" with "Cambiar" and "Cancelar", the card does not repeat it, and nothing is stored until "Cambiar"

#### Scenario: The menu of the week
- **WHEN** the preview is of the menu the selected week already has
- **THEN** its footer button reads "Menú del 5 oct" with a check, disabled

### Requirement: The week preview needs a session and trusts only the menu

The action that reads a preview SHALL check the session before it reads the request; without a valid session it SHALL read nothing and send the request to `/login`. It SHALL read one value, the menu number, validated as a positive integer, and SHALL return only the names of the dishes by day and meal. A number that is not valid or not stored, a failing read, and the wait have each their message ("Ese menú no existe.", "No se ha podido cargar la semana. Inténtalo de nuevo.", "Cargando…").

#### Scenario: Previewing without a session
- **WHEN** a request to the preview action carries no valid session
- **THEN** no menu is read and the response sends the browser to `/login`

#### Scenario: A menu number that is not valid
- **WHEN** a signed-in user posts the preview action with `"12abc"`, `0`, `-3`, `1.5`, a file or no value
- **THEN** no menu is read and the preview says "Ese menú no existe."

#### Scenario: A menu that is not stored
- **WHEN** a signed-in user posts the preview action with a positive integer no stored menu has
- **THEN** the preview says "Ese menú no existe."

#### Scenario: Only names
- **WHEN** a signed-in user previews a stored menu whose dishes have recipes
- **THEN** the answer holds the names of its dishes by day and meal, and no recipe, ingredient, file name or date

#### Scenario: The database fails
- **WHEN** reading the menu fails
- **THEN** the preview says "No se ha podido cargar la semana. Inténtalo de nuevo." and the cards stay

#### Scenario: Loading
- **WHEN** the user opens a preview and the answer has not arrived
- **THEN** the dialog is open with the heading "Menú N" and says "Cargando…"
