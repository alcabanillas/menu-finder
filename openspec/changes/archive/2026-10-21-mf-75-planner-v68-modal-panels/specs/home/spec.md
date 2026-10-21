## MODIFIED Requirements

### Requirement: The dashboard shows what is on today

The dashboard's level-one heading SHALL be "Qué toca hoy", with today's date above it. With a menu for this week, it SHALL show the dishes of today's lunch and dinner, each meal under its label, and a link "Ver menú" to `/menu`. A meal with no dishes SHALL NOT be shown; when today has no dishes at all, it SHALL say that the menu has no dishes for today. On a phone the meals SHALL go one below the other, and a dish with a recipe SHALL unfold its recipe in place; a dish without one SHALL say it has no recipe. From an 800 px container the meals SHALL go side by side, each dish a row with its total time; a dish with a recipe SHALL be a control that opens its recipe in the modal panel of `/menu`, against the right edge of the window, and nothing SHALL unfold in the page. Escape or the panel's close button SHALL close it and return the focus to the dish.

#### Scenario: Today's lunch and dinner
- **WHEN** a signed-in user whose menu of this week has dishes for today's lunch and dinner opens `/`
- **THEN** the page has the heading "Qué toca hoy" with today's date, those dishes under "Comida" and "Cena", no dish of another day, and a link "Ver menú" to `/menu`

#### Scenario: A day with no dishes
- **WHEN** a signed-in user whose menu of this week has no dishes for today opens `/`
- **THEN** the page says "El menú no incluye platos para hoy." and shows neither "Comida" nor "Cena"

#### Scenario: On a phone a dish unfolds its recipe
- **WHEN** the user, below an 800 px container, activates a dish of today that has a recipe
- **THEN** its recipe is shown in place and the control is marked as expanded

#### Scenario: From 800 px a dish opens its recipe in the side panel
- **WHEN** the user, from an 800 px container, activates a dish of today that has a recipe
- **THEN** a modal dialog with the recipe opens against the right edge of the window, over a dark backdrop, nothing unfolds in the page, and the control is marked as expanded

#### Scenario: Closing the panel returns to the dish
- **WHEN** the recipe panel is open and the user presses Escape or the panel's close button
- **THEN** the panel closes and the focus is on the dish that opened it
