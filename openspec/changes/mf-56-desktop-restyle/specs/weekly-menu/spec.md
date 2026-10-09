## REMOVED Requirements

### Requirement: From 800 px the page shows the whole week
**Reason**: The week table of MF-23.2 is replaced by one card per day, after the revised mock (MF-56).
**Migration**: "From 800 px the page shows the week as day cards" below holds the same days, meals and dishes, and the same rules for Sunday, today, recipes and the page without JavaScript.

## ADDED Requirements

### Requirement: From 800 px the page shows the week as day cards

When the content is 800 px wide or wider, the page SHALL show the active menu's week as one card per day instead of the day tabs: Monday to Saturday, and Sunday only when the menu has dishes for it, in the order of the week. Each card SHALL be headed by its weekday and its date ("7 de octubre"). Today's card SHALL be highlighted and SHALL say "Hoy" in text, not only by colour. Under the labels "Comida" and "Cena", each card SHALL show the dishes of that meal in the menu's order; a meal with no dishes SHALL be left out, and a day with no dishes SHALL say "El menú no incluye platos para este día". A dish with a recipe SHALL show its total time in minutes when known and SHALL be a control that opens its recipe; a dish without one SHALL be plain text. Without JavaScript, the cards SHALL still show every day's dishes.

#### Scenario: The week as day cards
- **WHEN** a signed-in user whose active menu is 3, from Monday 2026-10-05, with dishes on every day, opens `/menu` on Wednesday 2026-10-07 on a screen 800 px wide or wider
- **THEN** the page shows seven day cards, from "Lunes" "5 de octubre" to "Domingo" "11 de octubre", each with its dishes under "Comida" and "Cena", the Wednesday card highlighted and saying "Hoy", and no day tabs

#### Scenario: Sunday without dishes is left out
- **WHEN** the menu has no dishes for Sunday
- **THEN** the page shows six day cards, Monday to Saturday

#### Scenario: A meal with no dishes
- **WHEN** a day has dishes for lunch but none for dinner
- **THEN** that day's card shows "Comida" with its dishes and no "Cena"

#### Scenario: A day with no dishes
- **WHEN** the menu has dishes on Sunday but none on Tuesday
- **THEN** Tuesday's card says "El menú no incluye platos para este día" and shows no "Comida" or "Cena"

#### Scenario: Dishes with and without a recipe
- **WHEN** a meal holds a dish whose recipe takes 45 minutes in total and a dish without a recipe
- **THEN** the first is a control that opens a dialog and shows "45 min", and the second is plain text with no time

#### Scenario: The cards without JavaScript
- **WHEN** a signed-in user with JavaScript disabled opens `/menu` on a screen 800 px wide or wider
- **THEN** the page shows every day's card with its dishes

## MODIFIED Requirements

### Requirement: From 800 px a dish opens its recipe in a panel

When the content is 800 px wide or wider, activating a dish with a recipe SHALL open a panel at the side of the page, on the side opposite the dish: on the right when the dish is in the left half of the page, and on the left otherwise. The panel SHALL be a dialog named after the dish, SHALL say the day and meal of the dish, and SHALL show the recipe as the card does: the times with a dash when unknown, the ingredients with their amounts and "opcional", and the numbered steps. When it opens, the focus SHALL move into the panel. Escape and the panel's close button SHALL close it and give the focus back to the dish that opened it. Activating another dish while the panel is open SHALL show that dish's recipe. The dish whose recipe is open SHALL be announced as expanded.

#### Scenario: Opening a recipe
- **WHEN** the user activates the dish "Lentejas" in Wednesday's lunch, whose recipe takes 45 minutes in total, with the ingredient "Lentejas" of 240 g and two preparation steps
- **THEN** a dialog named after "Lentejas" opens with "Miércoles · Comida", 45 minutes, "Lentejas" with "240 g" and the two steps numbered 1 and 2; the focus is inside the dialog and the dish is announced as expanded

#### Scenario: The panel takes the side away from the dish
- **WHEN** the user opens a dish in the left half of the page and then a dish in the right half
- **THEN** the panel of the first dish lies on the right of the page and the panel of the second on the left

#### Scenario: Closing with Escape
- **WHEN** the panel is open and the user presses Escape
- **THEN** the panel closes and the focus returns to the dish that opened it, now announced as collapsed

#### Scenario: Closing with the close button
- **WHEN** the panel is open and the user activates "Cerrar receta"
- **THEN** the panel closes and the focus returns to the dish that opened it

#### Scenario: Opening another dish
- **WHEN** the panel shows one dish's recipe and the user activates another dish with a recipe
- **THEN** the panel shows the other dish's recipe, and only that dish is announced as expanded
