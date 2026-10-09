## ADDED Requirements

### Requirement: From 800 px the categories are listed in an index

When the content is 800 px wide or wider, the page SHALL show beside the items an index of the categories of the current view, in the order of the list, labelled "Categorías". Each entry SHALL hold the category's control to tick every item, with how many of its items are ticked over its total ("1/2"), and a link to that category in the page with the category's full name. At this width each category of the list SHALL be headed by its name and the same count, and the tick-every-item control SHALL be offered once per category, in the index. Below 800 px the page SHALL show no index, and each category SHALL keep its own tick-every-item control. The index SHALL work without JavaScript: its controls post the same tick as the category's control, and its links move to the category.

#### Scenario: The index lists the categories
- **WHEN** a user whose current list has "Garbanzos cocidos" ticked, of the categories "Legumbres" (2 items) and "Lácteos" (1 item), opens `/shopping-list` on a screen 800 px wide or wider
- **THEN** the page shows an index "Categorías" with "Legumbres" and "1/2", then "Lácteos" and "0/1", and the category "Legumbres" in the list is headed by its name and "1/2"

#### Scenario: Ticking a category from the index
- **WHEN** on a screen 800 px wide or wider the user uses the index control of "Legumbres", with one of its two items ticked
- **THEN** both items of "Legumbres" are ticked, the index shows "2/2", and no item of another category changes

#### Scenario: A link goes to its category
- **WHEN** the user follows the index link "Lácteos"
- **THEN** the page moves to the category "Lácteos" of the list

#### Scenario: One tick-every-item control per category
- **WHEN** a user opens `/shopping-list` on a screen 800 px wide or wider
- **THEN** each category offers exactly one tick-every-item control, the one in the index

#### Scenario: The index follows the view
- **WHEN** a user with every item of "Legumbres" ticked opens the view "Por comprar" on a screen 800 px wide or wider
- **THEN** the index lists "Lácteos" and not "Legumbres"

#### Scenario: No index on a narrow screen
- **WHEN** a user opens `/shopping-list` on a screen narrower than 800 px
- **THEN** the page shows no index and each category shows its own "Marcar todos" control

#### Scenario: Ticking from the index without JavaScript
- **WHEN** a user with JavaScript disabled uses the index control of "Lácteos" on a screen 800 px wide or wider
- **THEN** the page reloads with "Leche" ticked and the index shows "1/1" for "Lácteos"
