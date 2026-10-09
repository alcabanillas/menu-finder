## ADDED Requirements

### Requirement: Past selections can be read within a ten-week window
The system SHALL allow reading the signed-in user's selections whose start date falls within the ten weeks before the current Monday, and those on or after the current Monday. Selections of other users SHALL NOT be returned. The window is applied in the use case, not only in the page.

#### Scenario: Selections in the window are returned
- **WHEN** the user has selections starting three weeks before and one week after the current Monday
- **THEN** both are returned, ordered by start date

#### Scenario: Selections older than the window are not returned
- **WHEN** the user has a selection starting eleven weeks before the current Monday
- **THEN** that selection is not returned

#### Scenario: Selections of another user are not returned
- **WHEN** another user has a selection starting in the window
- **THEN** it is not returned for the signed-in user

#### Scenario: Read without a user id
- **WHEN** the read is requested with an empty user id
- **THEN** no selection is returned and the read fails without exposing data

### Requirement: The menu of one week is read by its number
When the page shows a week, the system SHALL read only the menu of that week's selection, by its menu number. It SHALL NOT read the full list of menus to display one week.

#### Scenario: One menu is read for the displayed week
- **WHEN** the user views a week whose selection has menu number 12
- **THEN** only menu 12 is read for that week

#### Scenario: Selection whose menu is missing is a failure
- **WHEN** the selection points to a menu number that is not stored
- **THEN** the read reports a failure, not an empty week
