## MODIFIED Requirements

### Requirement: No menu fits

When the search gives a ranking with no menu, the page SHALL show, under the chips, the heading "Ningún menú encaja con lo que has pedido" and SHALL show no card and no results heading.

#### Scenario: No menu fits
- **WHEN** the search gives a structure and an empty ranking
- **THEN** the page shows the chips and the heading "Ningún menú encaja con lo que has pedido", and shows no card

### Requirement: Candidate cards with evidence and a choose button

Each menu of the ranking SHALL be shown as a card with its rank, the heading "Menú N", a summary sentence and one evidence line per unit of the request, in the order of the chips. "Menú N" SHALL be the heading of the card, with no badge.

Each evidence line SHALL start with the state of its unit, from the evidence the search gave (spec `menu-search`, "Evidence of a unit"):

| Evidence | State | Detail |
|---|---|---|
| a `literal` dish | ✓, olive | "Martes, comida · <dish name>" |
| a `similar` dish | ≈, ochre | "parecido: Martes, comida · <dish name>" |
| no dish, all members `exclude` | ✓, olive | "no aparece en la semana" |
| no dish, any member `include` | ✕, terracotta | "ningún plato" |

A week-wide exclusion SHALL always read "no aparece en la semana", never that no dish holds it: its filter only looks for the word. After the state, the line SHALL name the terms of its unit: olive for an `include` member, an included `attribute` among them, and terracotta for an `exclude` member, which SHALL also carry a minus, so that the polarity is not told by colour alone; in a `sameDish` unit the members SHALL be separated by a thin vertical rule, and in an `anyOf` unit by an "o". A long term SHALL wrap, never be cut or overflow the card.

The summary sentence SHALL be built only from the counts of the lines: a unit is met when its state is ✓ or ≈. With N units of which X are met and S are ≈, it SHALL read "Cumple las N cosas que pides." when X is N and N is more than one, "Cumple lo que pides." when N and X are one, and "Cumple X de las N cosas que pides." otherwise; when S is one or more, the final full stop SHALL give way to ", una con un plato parecido." for one or ", <S> con platos parecidos." for more, with S in words up to ten ("dos", "tres"). Every unit counts, the week-wide exclusions included.

Each line SHALL have a text for screen readers: the text of its chip ("Restriction chips"), ": " and its detail; its state, terms, icons and separators SHALL be hidden from screen readers. Their only button SHALL be the choose button ("Choosing a menu from the ranking for the selected week"), whose accessible name SHALL start with its visible text and also name the menu. When the weeks cannot be read, the cards SHALL have no button.

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

#### Scenario: The only action of a card is choosing it
- **WHEN** the cards are shown with "La que viene" selected and empty
- **THEN** each card has the heading "Menú N" and no badge, and one button, "Elegir para el 12 oct", whose accessible name starts with its visible text and names its menu, as "Elegir para el 12 oct (Menú 22)"

#### Scenario: No buttons without the weeks
- **WHEN** the weeks of the user cannot be read
- **THEN** the cards are shown with no button

#### Scenario: The summary says only what the lines say
- **WHEN** any card is shown
- **THEN** its summary is one of the fixed sentences of this requirement, with numbers equal to the counts of its lines, and holds no term, dish or other text

## ADDED Requirements

### Requirement: Results heading

When the search gives a ranking with at least one menu and some unit of the request is not a week-wide exclusion, the cards SHALL be preceded by the heading "Resultados" with, above it, the line "Los N que mejor encajan" for N menus or "El que mejor encaja" for one, and every card SHALL have its rank and its summary sentence.

#### Scenario: Three menus
- **WHEN** the search returns three menus for `garbanzos`
- **THEN** the page shows "Los 3 que mejor encajan" and "Resultados" before the cards

#### Scenario: One menu
- **WHEN** the search returns one menu
- **THEN** the page shows "El que mejor encaja"

#### Scenario: An exclusion with another constraint
- **WHEN** the structure has `garbanzos` and the ungrouped exclusion `cerdo`
- **THEN** the page shows "Los N que mejor encajan", and the cards have their rank and their summary

### Requirement: Results of a request with only exclusions

When every unit of the request is a week-wide exclusion and the ranking has a menu, the cards SHALL be preceded by "Todos cumplen lo que pides" above the heading "Resultados", followed by "Como solo has pedido quitar cosas, todos estos menús lo cumplen por igual: salen por número de menú.", and the cards SHALL have no rank and no summary sentence.

#### Scenario: Only week-wide exclusions
- **WHEN** a signed-in user searches "nada de cerdo" and the structure has only the ungrouped exclusion `cerdo`
- **THEN** the page shows "Todos cumplen lo que pides", "Resultados" and "Como solo has pedido quitar cosas, todos estos menús lo cumplen por igual: salen por número de menú.", and the cards show "Menú N" with no rank and no summary
