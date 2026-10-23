# Spec Delta

## MODIFIED Requirements

### Requirement: Search messages

When a search gives no ranking, the page SHALL show, under the search box, a panel like the one of "No menu fits", with a round icon, a heading for the group of the outcome, the message of the outcome unchanged, and the actions of the group. It SHALL show no chips, no cards and no strip "Lo que has pedido". The panel SHALL be announced as an alert and labelled by its heading; the icon SHALL be hidden from screen readers.

| Outcome | Message |
|---|---|
| empty request | "Escribe qué te apetece." |
| request longer than 300 characters | "La petición es demasiado larga: como mucho 300 caracteres." |
| request rejected as `out-of-catalog` | "Los menús solo tienen comidas y cenas: no hay postres, desayunos ni bebidas." |
| request rejected with any other category | "Eso no parece una petición de menús. Prueba a decir qué te apetece comer." |
| answer that does not validate, or nothing to search | "No he sabido entender la petición. Prueba a escribirla de otra forma." |
| daily limit reached | "Hoy ya no se pueden hacer más búsquedas. Vuelve a intentarlo mañana." |
| any failure of the system | "No se ha podido buscar. Inténtalo de nuevo." |

| Group | Outcomes | Heading | Actions |
|---|---|---|---|
| request | empty, too long, rejected with a category other than `out-of-catalog`, does not validate, nothing to search | "Hay que decirlo de otra forma" | "Editar mi búsqueda", the tip, "O prueba con algo que suele funcionar" and the suggestions |
| catalog | rejected as `out-of-catalog` | "Eso no está en los menús" | "Editar mi búsqueda", "O prueba con algo que suele funcionar" and the suggestions |
| failure | any failure of the system | "Algo ha fallado" | "Editar mi búsqueda" |
| limit | daily limit reached | "Has llegado al límite de hoy" | none |

#### Scenario: Empty box
- **WHEN** a signed-in user sends the search with the box empty, with or without JavaScript
- **THEN** the browser does not send it: no request reaches the server and no breadcrumb is added

#### Scenario: Empty request
- **WHEN** a signed-in user sends a request of only spaces
- **THEN** the page says "Escribe qué te apetece." and no search runs

#### Scenario: Request too long
- **WHEN** a signed-in user sends a request of 301 characters
- **THEN** the page says "La petición es demasiado larga: como mucho 300 caracteres." and no search runs

#### Scenario: Rejected request
- **WHEN** the search returns a rejection with the category `gibberish`, `off-topic`, `instruction` or `not-a-search`
- **THEN** the page says "Eso no parece una petición de menús. Prueba a decir qué te apetece comer."

#### Scenario: Out-of-catalog request
- **WHEN** the search returns a rejection with the category `out-of-catalog`
- **THEN** the page says "Los menús solo tienen comidas y cenas: no hay postres, desayunos ni bebidas." and shows no chips or cards

#### Scenario: Nothing to search
- **WHEN** the search returns `nothing-to-search` or `invalid-answer`
- **THEN** the page says "No he sabido entender la petición. Prueba a escribirla de otra forma."

#### Scenario: Daily limit reached
- **WHEN** the search returns `llm-limit-reached`
- **THEN** the page says "Hoy ya no se pueden hacer más búsquedas. Vuelve a intentarlo mañana."

#### Scenario: Failure of the system
- **WHEN** the search returns `decomposer-failed`, `embedding-failed`, `search-failed`, `index-not-loaded` or `invalid-request`
- **THEN** the page says "No se ha podido buscar. Inténtalo de nuevo."

#### Scenario: A ranking that does not match its request
- **WHEN** the search returns a unit with a constraint id the structure does not have, or a menu whose evidence does not have one item per unit
- **THEN** the page says "No se ha podido buscar. Inténtalo de nuevo." with the outcome `search-failed`, and shows no chips or cards

#### Scenario: Panel of a request to say otherwise
- **WHEN** the search returns a rejection with the category `gibberish`
- **THEN** an alert labelled "Hay que decirlo de otra forma" shows the message, "Editar mi búsqueda", the tip, "O prueba con algo que suele funcionar" and four suggestions led by "Al azar"

#### Scenario: Panel of a request out of the catalog
- **WHEN** the search returns a rejection with the category `out-of-catalog`
- **THEN** an alert labelled "Eso no está en los menús" shows the message, "Editar mi búsqueda" and the suggestions led by "Al azar", and not the tip

#### Scenario: Panel of a failure
- **WHEN** the search returns `search-failed`
- **THEN** an alert labelled "Algo ha fallado" shows the message and "Editar mi búsqueda", and no tip or suggestions

#### Scenario: Panel of the daily limit
- **WHEN** the search returns `llm-limit-reached`
- **THEN** an alert labelled "Has llegado al límite de hoy" shows the message, and no button, tip or suggestions

#### Scenario: Nothing of a search above the panel
- **WHEN** a search gives no ranking
- **THEN** the page shows neither "Prueba con" above the panel nor the strip "Lo que has pedido"

### Requirement: Suggestions to try

Until a search returns an answer, the page SHALL show under the search box "Prueba con" and a row of chips: "Al azar" and four requests taken at random, on each load, from a fixed list of requests that return results. Activating a request SHALL run that search with its text, in the body of the request and never in the URL. The row SHALL be the same at every width and hidden while a search runs. After an answer with no menu or an error, the suggestions SHALL be only inside its panel.

#### Scenario: Before searching
- **WHEN** a signed-in user opens `/planner`
- **THEN** the page shows "Prueba con", the chip "Al azar" first and four requests after it, and no loose random button

#### Scenario: A suggestion runs a search
- **WHEN** the user activates the suggestion "de cuchara"
- **THEN** the search runs with the text "de cuchara", the chips and menus of that search are shown, and the URL holds no part of the text

#### Scenario: A suggestion without JavaScript
- **WHEN** a signed-in user with JavaScript disabled activates a suggestion
- **THEN** the page that comes back shows the chips and the menus of that search

#### Scenario: The list gives results
- **WHEN** each request of the fixed list is searched
- **THEN** every one of them returns at least one menu

#### Scenario: The row goes after a search
- **WHEN** a search returns menus
- **THEN** "Prueba con" is no longer shown, and neither is "Al azar"

#### Scenario: The row stays after a failed search
- **WHEN** a search is rejected with the category `gibberish`
- **THEN** "Prueba con" is no longer shown above, and the suggestions, "Al azar" first, stay inside the panel of the error under "O prueba con algo que suele funcionar"

### Requirement: Editing the last request

"Editar mi búsqueda" SHALL put in the search box the text of the last request exactly as the user wrote it, without trimming or changing it, SHALL focus the box with the cursor at its end, and SHALL NOT send anything. It SHALL be shown only when there is a last request, and it needs JavaScript. It SHALL work the same from the panel of no menu and from the panel of an error.

#### Scenario: The request comes back as it was
- **WHEN** a search "  cenas sin horno  " gives no menu and the user activates "Editar mi búsqueda"
- **THEN** the box holds "  cenas sin horno  ", has the focus with the cursor at the end, and no search runs

#### Scenario: Nothing is rewritten
- **WHEN** the user activates the button twice
- **THEN** the box holds the same text both times

#### Scenario: Not shown without a request
- **WHEN** the no-results panel has no last request
- **THEN** it does not show "Editar mi búsqueda"

#### Scenario: The request comes back after an error
- **WHEN** a search "una tarta de queso" is rejected as `out-of-catalog` and the user activates "Editar mi búsqueda"
- **THEN** the box holds "una tarta de queso", has the focus, and no search runs
