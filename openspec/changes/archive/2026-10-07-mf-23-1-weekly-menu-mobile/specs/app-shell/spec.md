## MODIFIED Requirements

### Requirement: Each of the four tabs leads to a page

`/menu` and `/shopping-list` SHALL exist, inside the shell, so that no tab of the main navigation leads to a missing page. `/menu` SHALL show the weekly menu (capability `weekly-menu`). Until the shopping list is built, `/shopping-list` SHALL show a heading with its name and a line saying what will be there. Each SHALL check the session like any other protected page.

#### Scenario: The Menú and Compra tabs lead to a page
- **WHEN** a signed-in user opens `/menu` or `/shopping-list`
- **THEN** the response is a page inside the shell, with a heading that starts with "Menú" or that reads "Compra" respectively, and the matching link of the navigation is marked as the current page

#### Scenario: The new pages need a session
- **WHEN** `/menu` or `/shopping-list` is requested with no session
- **THEN** the response is a redirect to `/login`
