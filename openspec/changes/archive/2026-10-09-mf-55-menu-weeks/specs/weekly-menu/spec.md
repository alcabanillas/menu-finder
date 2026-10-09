## ADDED Requirements

### Requirement: The page moves between weeks from its header
The `/menu` page SHALL show, in its header, a previous-week control, a next-week control and a control that returns to the current week. The page SHALL show the week chosen by the `startsOn` query parameter, whose value is the Monday of that week as `YYYY-MM-DD`. Without that parameter, the page SHALL show the current week.

#### Scenario: Going back one week
- **WHEN** the user with a session activates the previous-week control on the current week
- **THEN** the page shows the week that starts seven days earlier, and its dates are those of that week

#### Scenario: Going forward one week
- **WHEN** the user with a session activates the next-week control on the current week
- **THEN** the page shows the week that starts seven days later

#### Scenario: Returning to the current week
- **WHEN** the user is viewing another week and activates the current-week control
- **THEN** the page shows the current week without a `startsOn` parameter

### Requirement: The look-back window is ten weeks
The page SHALL allow viewing up to ten weeks before the current week. The previous-week control SHALL stay enabled for every week inside the window, whether or not that week has a menu. Once the tenth week back is shown, the previous-week control SHALL be disabled.

#### Scenario: The previous-week control stays enabled over a week without menu
- **WHEN** the user views a week back with no selection of their own
- **THEN** the previous-week control is enabled and the page shows the empty week message

#### Scenario: The tenth week back is the last one reachable
- **WHEN** the user views the tenth week back, whose Monday is seventy days before the current Monday
- **THEN** the previous-week control is disabled

#### Scenario: A week older than the window is not shown
- **WHEN** a request asks for a `startsOn` more than seventy days before the current Monday
- **THEN** the page shows the current week instead of an error

### Requirement: The look-ahead window is the next week
The page SHALL allow viewing only the week after the current one, not any later week. The next-week control SHALL be disabled when the next week is shown.

#### Scenario: A week beyond the next one is not shown
- **WHEN** a request asks for a `startsOn` more than seven days after the current Monday
- **THEN** the page shows the current week instead of an error

#### Scenario: Next week is reachable and then the control is disabled
- **WHEN** the user views the next week
- **THEN** the next-week control is disabled

### Requirement: A week without menu shows the empty state with a link to the planner
When the displayed week has no selection of the user, the page SHALL show the empty-menu message for that week and a link to `/planner`. The page SHALL NOT show dishes or an error for that week.

#### Scenario: Empty week
- **WHEN** the user views a week inside the window with no selection
- **THEN** the page shows the empty-menu message and a link to `/planner`

### Requirement: The startsOn parameter is validated before use
The page SHALL accept `startsOn` only when it is a single string of exactly ten characters in `YYYY-MM-DD` form that names a real calendar date, is a Monday, and lies inside the window. The page SHALL use the validated date only, never the raw string. Any other value SHALL be ignored, and the page SHALL show the current week without reporting an error.

#### Scenario: Not a date
- **WHEN** `startsOn` is `not-a-date`
- **THEN** the page shows the current week and reports no error

#### Scenario: Wrong format
- **WHEN** `startsOn` is `2026/10/05`, `05-10-2026` or `2026-10-5`
- **THEN** the page shows the current week

#### Scenario: Impossible calendar date
- **WHEN** `startsOn` is `2026-02-30` or `2026-13-01`
- **THEN** the page shows the current week and the date does not roll over into another day

#### Scenario: Surrounding whitespace
- **WHEN** `startsOn` is a valid Monday with a leading or trailing space
- **THEN** the page shows the current week

#### Scenario: Not a Monday
- **WHEN** `startsOn` is a Wednesday inside the window
- **THEN** the page shows the current week

#### Scenario: Repeated parameter
- **WHEN** the URL carries `startsOn` twice, as `startsOn=2026-10-05&startsOn=2026-09-28`
- **THEN** the page shows the current week and neither value is used

#### Scenario: Oversized value
- **WHEN** `startsOn` is longer than ten characters
- **THEN** the page shows the current week without parsing the whole value

#### Scenario: Injection-shaped value
- **WHEN** `startsOn` contains SQL or markup text, such as `2026-10-05' OR '1'='1`
- **THEN** the page shows the current week, and the text is neither executed nor rendered

#### Scenario: Boundary Mondays are accepted
- **WHEN** `startsOn` is the Monday seventy days before the current Monday, or the Monday seven days after it
- **THEN** the page shows that week

### Requirement: Only the user's own menus are shown, and only with a session
The week shown SHALL be laid from the signed-in user's own selection for that week. A request without a session SHALL NOT show any menu.

#### Scenario: Request without a session
- **WHEN** a request for `/menu` arrives without a session
- **THEN** the request is redirected to sign-in and no menu data is rendered

#### Scenario: Another user's selection is not shown
- **WHEN** the user with a session asks for a week in which only another user has a selection
- **THEN** the page shows the empty-menu message for that week and no dish of the other user
