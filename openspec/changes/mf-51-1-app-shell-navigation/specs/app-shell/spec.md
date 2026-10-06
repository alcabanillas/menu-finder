## Purpose
The frame that every page with a session shares: the header, the main navigation and the content area. It says what the frame holds, how the navigation behaves and adapts to the width, and that the frame is not what protects the pages (UI-design-system, UI-home-sin-login).

## ADDED Requirements

### Requirement: Pages with a session render inside the shell

Every protected page SHALL render inside a shell made of a header with the product's wordmark and the main navigation, and a content area that is the page's only main landmark. `/` and `/login` SHALL NOT render inside the shell.

#### Scenario: A protected page has the shell
- **WHEN** a signed-in user opens `/planner`
- **THEN** the page has a header with the wordmark "Menu Finder", the main navigation and exactly one main landmark that holds the content of `/planner`

#### Scenario: The sign-in screens have no shell
- **WHEN** `/` or `/login` is requested with no session
- **THEN** the response has no main navigation

### Requirement: The main navigation has four tabs

The shell SHALL offer a navigation labelled "Principal" with four links, in this order: "Hoy" to `/`, "Buscar" to `/planner`, "Menú" to `/menu` and "Compra" to `/shopping-list`. They SHALL be real links that work without JavaScript. The link of the route being shown SHALL be marked as the current page for assistive technology, and no other link SHALL be.

#### Scenario: The four links
- **WHEN** a protected page is rendered
- **THEN** the navigation "Principal" has the links "Hoy", "Buscar", "Menú" and "Compra", in that order, each with the destination above

#### Scenario: The current route is marked
- **WHEN** the shell is rendered for `/planner`
- **THEN** "Buscar" is marked as the current page and "Hoy", "Menú" and "Compra" are not

#### Scenario: A route that is not a tab marks none
- **WHEN** the shell is rendered for a route that none of the four links points to
- **THEN** no link is marked as the current page

#### Scenario: Navigation without JavaScript
- **WHEN** a signed-in user opens `/planner` with JavaScript disabled
- **THEN** the four links are in the page and "Buscar" is marked as the current page

### Requirement: The navigation adapts to the width

From 640 px of width the shell SHALL show the tabs in the header. Below 640 px it SHALL show them in a bar at the bottom of the screen. At any width only one of the two SHALL be exposed to assistive technology, so that the four links are not announced twice.

#### Scenario: Wide screen
- **WHEN** a signed-in user opens `/planner` on a screen 1024 px wide
- **THEN** the four links are visible inside the header, and the navigation "Principal" appears once to assistive technology

#### Scenario: Narrow screen
- **WHEN** a signed-in user opens `/planner` on a screen 375 px wide
- **THEN** the four links are visible at the bottom of the screen, below the content, and the navigation "Principal" appears once to assistive technology

### Requirement: The shell can be skipped and has labelled landmarks

The first element that takes the keyboard focus SHALL be a link "Saltar al contenido" that moves the focus to the content area. The shell SHALL expose a banner (the header), the navigation "Principal" and one main landmark.

#### Scenario: The skip link is first
- **WHEN** a signed-in user opens `/planner` and presses Tab once
- **THEN** the focus is on the link "Saltar al contenido"

#### Scenario: The skip link moves the focus
- **WHEN** the user activates the link "Saltar al contenido"
- **THEN** the focus is on the main landmark

### Requirement: The shell is not an access control

The shell SHALL NOT decide who sees a page. Every page inside it SHALL check the session itself, as the requirement "Protected routes require a session checked on the server" of `authentication` says, and a request with no valid session SHALL get a redirect to `/login` with no part of the shell in the response.

#### Scenario: No session gets no shell
- **WHEN** a request for `/planner` carries no session cookie, or a forged one
- **THEN** the response is a redirect to `/login` and its body has none of the shell: no link "Saltar al contenido" and no navigation "Principal"

#### Scenario: Every page inside the shell checks the session
- **WHEN** a page is added inside the shell without a session check
- **THEN** the automated check of protected pages fails
