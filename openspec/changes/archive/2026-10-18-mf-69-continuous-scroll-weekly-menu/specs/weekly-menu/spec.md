# Spec Delta: weekly-menu

## MODIFIED Requirements

### Requirement: The page shows the active menu's week

`/menu` SHALL show to a signed-in user their active menu: the menu of their selection that starts on the Monday of the week that holds today, with "today" being the date in Europe/Madrid. The page SHALL have a heading "Menú N", with N the menu number, and above it "Semana del D de MES", with the Monday it starts on. When the content is narrower than 800 px, it SHALL show a sticky day navigation bar with buttons for all seven days of that week, Monday to Sunday, each with its weekday and the day of the month. Today's button SHALL carry a distinctive mark. The bar SHALL stay below the app's sticky header. On initial load, when the week holds today, the page SHALL position the viewport at today's day section; otherwise it SHALL open at the top.

#### Scenario: The week of the active menu
- **WHEN** a signed-in user whose active menu is 3, from Monday 2026-10-05, opens `/menu` on Wednesday 2026-10-07 on a screen narrower than 800 px
- **THEN** the heading reads "Menú 3", the line above it reads "Semana del 5 de octubre", the sticky bar shows the days 5 to 11, Wednesday 7 is marked as today, and the view is anchored at Wednesday's section

#### Scenario: Next week's menu is not the active one
- **WHEN** a signed-in user whose only selection starts on the next Monday opens `/menu`
- **THEN** the page shows no menu and says there is no menu for this week

#### Scenario: A week without today opens at the top
- **WHEN** the user opens on a screen narrower than 800 px a week that does not hold today
- **THEN** the page does not scroll and the heading and the week navigation stay in view

#### Scenario: The bar stays under the header
- **WHEN** the user scrolls the page on a screen narrower than 800 px
- **THEN** the day navigation bar stays visible right below the app's header, not behind it

### Requirement: The selected day shows its dishes

When the content is narrower than 800 px, the page SHALL show all days of the week in sequential vertical scroll order. Each day SHALL display its weekday and date written in Spanish ("Miércoles 7 de octubre"), followed by its dishes under "Comida" and "Cena" in the menu's order. Activating a day button in the sticky navigation bar SHALL scroll the page so that day's section starts right below the bar, without animation when the user prefers reduced motion. The arrow keys, Home and End SHALL move the focus among the day buttons and activate the day they reach. As the user scrolls through the days, the sticky day navigation bar SHALL detect the day currently in view and update the active day indicator accordingly. A day with no dishes SHALL state "El menú no incluye platos para este día". Without JavaScript, all days of the week SHALL remain rendered in vertical order.

#### Scenario: Today's dishes
- **WHEN** the page opens on Wednesday and the menu has two dishes for Wednesday's lunch and one for its dinner
- **THEN** the page anchors at Wednesday's section showing "Miércoles 7 de octubre", the two dishes under "Comida" and the one under "Cena", in the menu's order

#### Scenario: Selecting another day
- **WHEN** the user selects the Monday button in the sticky bar
- **THEN** the page scrolls to Monday's section and the Monday button becomes the active one

#### Scenario: Moving with the keyboard
- **WHEN** the Wednesday button has the focus and the user presses the right arrow
- **THEN** the Thursday button gets the focus and becomes the active one, and the page scrolls to Thursday's section

#### Scenario: Reduced motion
- **WHEN** a user who prefers reduced motion selects the Monday button
- **THEN** the page jumps to Monday's section without a smooth scroll

#### Scenario: A day with no dishes
- **WHEN** the menu has no dishes for a day in the weekly menu
- **THEN** that day's section says "El menú no incluye platos para este día" and shows no "Comida" or "Cena"

#### Scenario: Without JavaScript
- **WHEN** a signed-in user with JavaScript disabled opens `/menu` on a screen narrower than 800 px
- **THEN** the page renders all seven days and their dishes in the document

#### Scenario: All days rendered in continuous scroll
- **WHEN** the user opens `/menu` on mobile with a menu that has dishes across multiple weekdays
- **THEN** all seven days are present in the DOM in sequence without requiring tab clicks to reveal subsequent days

#### Scenario: A short last day
- **WHEN** today is Sunday and the menu has no dishes for Sunday
- **THEN** the page opens with Sunday's section right below the bar and the Sunday button is the active one, not Saturday's

#### Scenario: Scrolling updates active day in sticky bar
- **WHEN** the user scrolls past Monday's section into Tuesday's section
- **THEN** the sticky navigation bar highlights Tuesday as the active day
