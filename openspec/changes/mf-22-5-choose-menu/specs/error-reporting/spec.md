## ADDED Requirements

### Requirement: Choosing breadcrumbs without request data

The browser SHALL add one Sentry breadcrumb when a menu of `/planner` is chosen and one when the answer arrives, so that a later browser error shows that a choice ran. Both SHALL say the week, `current` or `next`, and the breadcrumb of the answer SHALL say whether a menu was chosen or which outcome stopped it. No breadcrumb SHALL carry the request text of the search, the terms of the chips or the names of the dishes.

#### Scenario: Breadcrumb when a menu is chosen
- **WHEN** a signed-in user who searched "garbanzos sin cerdo" chooses a menu for next week with JavaScript
- **THEN** one breadcrumb of the planner category records that a menu was chosen for `next`, and none of its fields contains "garbanzos" or "cerdo"

#### Scenario: Breadcrumb when the answer arrives
- **WHEN** the choice is stored
- **THEN** one breadcrumb records the outcome `chosen` and the week, with no term or dish name

#### Scenario: Breadcrumb of a refused choice
- **WHEN** the choice is refused as a locked week
- **THEN** one breadcrumb records the outcome `week-locked`, with no request text
