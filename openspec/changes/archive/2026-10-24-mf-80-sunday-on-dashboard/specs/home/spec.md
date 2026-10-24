## MODIFIED Requirements

### Requirement: The dashboard shows what is on today

The dashboard's level-one heading SHALL be "Qué toca hoy", with today's date above it, and the colour bar of that date SHALL be the day's colour; Sunday's, which is white, SHALL have a thin `border-strong` border so that it shows. With a menu for this week, it SHALL show the dishes of today's lunch and dinner, each meal under its label, and a link "Ver menú" to `/menu`. A meal with no dishes SHALL NOT be shown; when today has no dishes at all, it SHALL say that the menu has no dishes for today. On a Sunday, which never has dishes, it SHALL show instead a grey card with a sun icon in a circle, the title "Domingo libre" and the text "¡Día libre! Hoy la cocina queda a vuestro gusto.", and SHALL NOT show the link "Ver menú". On a phone the meals SHALL go one below the other, and a dish with a recipe SHALL unfold its recipe in place; a dish without one SHALL say it has no recipe. From an 800 px container the meals SHALL go side by side, each dish a row with its total time; a dish with a recipe SHALL be a control that opens its recipe in the modal panel of `/menu`, against the right edge of the window, and nothing SHALL unfold in the page. Escape or the panel's close button SHALL close it and return the focus to the dish.

#### Scenario: Today's lunch and dinner
- **WHEN** a signed-in user whose menu of this week has dishes for today's lunch and dinner opens `/`
- **THEN** the page has the heading "Qué toca hoy" with today's date, those dishes under "Comida" and "Cena", no dish of another day, and a link "Ver menú" to `/menu`

#### Scenario: A day with no dishes
- **WHEN** a signed-in user whose menu of this week has no dishes for today, and today is not a Sunday, opens `/`
- **THEN** the page says "El menú no incluye platos para hoy." and shows neither "Comida" nor "Cena"

#### Scenario: Sunday is a rest day
- **WHEN** a signed-in user whose menu of this week has no dishes for Sunday opens `/` on that Sunday
- **THEN** the page shows a card titled "Domingo libre" with the text "¡Día libre! Hoy la cocina queda a vuestro gusto.", does not say "El menú no incluye platos para hoy.", shows neither "Comida" nor "Cena" for today, and has no link "Ver menú"

#### Scenario: Sunday's colour bar shows
- **WHEN** a signed-in user opens `/` on a Sunday
- **THEN** the colour bar by today's date has the class of a thin `border-strong` border, and the bar of any other day has none

#### Scenario: On a phone a dish unfolds its recipe
- **WHEN** the user, below an 800 px container, activates a dish of today that has a recipe
- **THEN** its recipe is shown in place and the control is marked as expanded

#### Scenario: From 800 px a dish opens its recipe in the side panel
- **WHEN** the user, from an 800 px container, activates a dish of today that has a recipe
- **THEN** a modal dialog with the recipe opens against the right edge of the window, over a dark backdrop, nothing unfolds in the page, and the control is marked as expanded

#### Scenario: Closing the panel returns to the dish
- **WHEN** the recipe panel is open and the user presses Escape or the panel's close button
- **THEN** the panel closes and the focus is on the dish that opened it

### Requirement: The dashboard shows the names of tomorrow's dishes

With a menu for this week, after today's dishes and the link "Ver menú", the dashboard SHALL show "Mañana" with tomorrow's weekday and day number, and only the names of tomorrow's lunch and dinner dishes, one per line, under "Comida" and "Cena": no times, no recipes and no controls. A meal with no dishes SHALL NOT be shown. On a Sunday, tomorrow SHALL be next week's Monday, taken from the user's menu for next week, and the block SHALL read "Mañana · Lunes 26 · Menú 31" (the Monday's weekday and day number and the number of that menu), with a link "Ver el menú de la semana que viene" to `/menu` for that week. When next week has no menu, the block SHALL be replaced by a notice with the title "La semana que viene aún no tiene menú", the text "Mañana empieza otra semana. Elige uno en Buscar: escribe lo que os apetece y verás los menús que encajan." and a primary button "Elegir menú para el 26 oct" (next Monday's short date) to `/planner?week=next`. When tomorrow has no dishes, the block SHALL NOT be shown. Whose next week is read SHALL come from the session only.

#### Scenario: Tomorrow's dishes
- **WHEN** a signed-in user whose menu has, for tomorrow (Saturday 17), "Arroz al horno" for lunch and "Tortilla francesa" for dinner opens `/`
- **THEN** the page shows "Mañana · sábado 17", "Arroz al horno" under "Comida" and "Tortilla francesa" under "Cena", with no control and no time on them

#### Scenario: Tomorrow without dishes
- **WHEN** a signed-in user whose menu has no dishes for tomorrow, and today is not a Sunday, opens `/`
- **THEN** the page has no "Mañana"

#### Scenario: On Sunday, tomorrow is next week's Monday
- **WHEN** a signed-in user with a menu this week and, for next week, a menu with "Lentejas estofadas" for Monday 26's lunch opens `/` on Sunday 25
- **THEN** the page shows "Mañana · Lunes 26 · Menú 31" (the number of that menu) and "Lentejas estofadas" under "Comida", with no control and no time on it, and a link "Ver el menú de la semana que viene" to `/menu?startsOn=2026-10-26`

#### Scenario: On Sunday, next week has no menu yet
- **WHEN** a signed-in user with a menu this week and none for next week opens `/` on a Sunday 25 October
- **THEN** the page has no "Mañana" block but a notice titled "La semana que viene aún no tiene menú", with the text "Mañana empieza otra semana. Elige uno en Buscar: escribe lo que os apetece y verás los menús que encajan." and a button "Elegir menú para el 26 oct" to `/planner?week=next`, and shows no dish

#### Scenario: On Sunday, next week's Monday has no dishes
- **WHEN** a signed-in user whose menu for next week has no dishes for Monday opens `/` on a Sunday
- **THEN** the page has no "Mañana"

#### Scenario: A parameter does not change whose next week is shown
- **WHEN** a signed-in user with no menu for next week requests `/?userId=<id of another user who has a menu for next week>` on a Sunday
- **THEN** the notice "La semana que viene aún no tiene menú" is shown and none of the other user's dishes or menu number

#### Scenario: Next week cannot be read
- **WHEN** reading next week's menu fails for a signed-in user on a Sunday
- **THEN** the page has no "Mañana", keeps today's block, the card of the weeks and the shopping block, and contains no error detail
