## MODIFIED Requirements

### Requirement: The navigation adapts to the width

From 800 px of window width, where the pages switch to their desktop layout, the shell SHALL show the tabs in the header, and the header SHALL be 64 px high. Below 800 px it SHALL show them in a bar at the bottom of the screen, and the header SHALL be 56 px high. At any width only one of the two SHALL be exposed to assistive technology, so that the four links are not announced twice.

#### Scenario: Wide screen
- **WHEN** a signed-in user opens `/planner` on a screen 1024 px wide
- **THEN** the four links are visible inside the header, and the navigation "Principal" appears once to assistive technology

#### Scenario: Narrow screen
- **WHEN** a signed-in user opens `/planner` on a screen 375 px wide
- **THEN** the four links are visible at the bottom of the screen, below the content, and the navigation "Principal" appears once to assistive technology

#### Scenario: A tablet in portrait
- **WHEN** a signed-in user opens `/planner` on a screen 700 px wide
- **THEN** the four links are in the bar at the bottom of the screen, the header is 56 px high, and the page shows its phone layout
