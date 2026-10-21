## ADDED Requirements

### Requirement: From 800 px a dish opens its recipe in a modal panel

When the content is 800 px wide or wider, activating a dish with a recipe SHALL open its recipe in a modal panel ("The recipe panel is modal"). The panel SHALL be a dialog named after the dish, SHALL say the day and meal of the dish, and SHALL show the recipe as the card does. When it opens, the focus SHALL move into the panel. Activating another dish while the panel is open SHALL show that dish's recipe. The dish whose recipe is open SHALL be announced as expanded.

#### Scenario: Opening a recipe
- **WHEN** the user activates the dish "Lentejas" in Wednesday's lunch, whose recipe takes 45 minutes in total, with the ingredient "Lentejas" of 240 g and two preparation steps
- **THEN** a dialog named after "Lentejas" opens with "Miércoles · Comida", 45 minutes, "Lentejas" with "240 g" and the two steps numbered 1 and 2; the focus is inside the dialog and the dish is announced as expanded

#### Scenario: Opening another dish
- **WHEN** the panel shows one dish's recipe and the user activates another dish with a recipe
- **THEN** the panel shows the other dish's recipe, and only that dish is announced as expanded

### Requirement: The recipe panel is modal

The recipe panel SHALL be a modal dialog 400 px wide against the right edge of the window, below the 64 px header, over a dark backdrop that leaves the header clear, wherever the dish is. The page behind SHALL NOT scroll while it is open, and Escape, the panel's close button and a tap on the backdrop SHALL close it and give the focus back to the dish that opened it.

#### Scenario: The panel lies on the right wherever the dish is
- **WHEN** the user opens a dish in the left half of the page and then a dish in the right half
- **THEN** both recipes open in the same panel against the right edge of the window, over a dark backdrop

#### Scenario: Closing with the backdrop
- **WHEN** the panel is open and the user taps the backdrop
- **THEN** the panel closes and the page scrolls again

#### Scenario: Closing with Escape
- **WHEN** the panel is open and the user presses Escape
- **THEN** the panel closes and the focus returns to the dish that opened it, now announced as collapsed

#### Scenario: Closing with the close button
- **WHEN** the panel is open and the user activates "Cerrar receta"
- **THEN** the panel closes and the focus returns to the dish that opened it

## REMOVED Requirements

### Requirement: From 800 px a dish opens its recipe in a panel
**Reason**: Replaced by "From 800 px a dish opens its recipe in a modal panel". The panel no longer takes the side away from the dish: it is modal, over a backdrop, so covering the dish does not matter, and it sits where the week preview of Buscar sits (UI-paneles-laterales).
**Migration**: Open the recipe in the modal panel against the right edge of the window; drop any choice of side.
