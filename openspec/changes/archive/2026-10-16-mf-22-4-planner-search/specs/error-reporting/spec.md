## ADDED Requirements

### Requirement: Search breadcrumbs without request data

The browser SHALL add one Sentry breadcrumb when a search of `/planner` is sent and one when its answer arrives, so that a later browser error shows that a search ran. The breadcrumb of the answer SHALL say whether the search gave a ranking or which outcome stopped it, and how many chips and menus it shows. No breadcrumb SHALL carry the request text, the terms of the chips or the names of the dishes.

#### Scenario: Breadcrumb when a search is sent
- **WHEN** a signed-in user sends the search "garbanzos sin cerdo" with JavaScript
- **THEN** one breadcrumb of the planner category records that a search was sent, and none of its fields contains "garbanzos" or "cerdo"

#### Scenario: Breadcrumb when the answer arrives
- **WHEN** the answer of that search shows two chips and five menus
- **THEN** one breadcrumb records a ranking with two chips and five menus, and none of its fields contains a term or a dish name

#### Scenario: Breadcrumb of a failed search
- **WHEN** the answer of a search is the daily limit reached
- **THEN** one breadcrumb records the outcome `llm-limit-reached`, with no request text
