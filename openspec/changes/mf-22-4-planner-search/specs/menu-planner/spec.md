## ADDED Requirements

### Requirement: Searching from a request

`/planner` SHALL offer a signed-in user a search box with the placeholder "¿Qué te apetece esta semana?". Sending it SHALL run one web search with the text of the request (spec `menu-search`, "Search from a request") and SHALL show, for that search only, the restriction chips of the request and the menus of its ranking, at most five, in ranking order. A new search SHALL replace the chips and menus of the previous one. The request text SHALL travel in the body of the request, never in the URL. The search SHALL work without JavaScript. While a search runs with JavaScript, the page SHALL say that it is searching, and the search button SHALL be disabled.

#### Scenario: Searching shows the chips and the top 5
- **WHEN** a signed-in user searches "garbanzos sin cerdo" and the search returns a structure with the constraints `garbanzos` and the exclusion `cerdo`, and the menus 12, 3, 20, 7 and 15 in that order
- **THEN** the page shows one chip for `garbanzos` and one for `cerdo`, and five cards ranked 1 to 5 for "Menú 12", "Menú 3", "Menú 20", "Menú 7" and "Menú 15"

#### Scenario: A new search replaces the previous one
- **WHEN** a signed-in user who searched "garbanzos" searches "lentejas"
- **THEN** the page shows only the chips and menus of "lentejas"

#### Scenario: The request text is not in the URL
- **WHEN** a signed-in user searches "garbanzos"
- **THEN** the URL of the page holds no part of the request text

#### Scenario: Searching without JavaScript
- **WHEN** a signed-in user with JavaScript disabled searches "garbanzos"
- **THEN** the page that comes back shows the chips and the menus of the search

#### Scenario: Searching in progress
- **WHEN** a signed-in user sends a search and its answer has not arrived
- **THEN** the page says it is searching and the search button is disabled

### Requirement: Restriction chips

The page SHALL show one chip per unit of the request: one for each constraint in no group, one for each `sameDish` group and one for each `anyOf` group, in the order of the first constraint of each unit. The chips SHALL be a list named "Lo que has pedido", and they SHALL be for guidance only: no chip SHALL be a control. Each member of a chip SHALL show its `term` exactly as the search returned it, with no word added. Each member SHALL carry an icon: a minus for an `exclude` constraint, a sparkles icon for an included `attribute`, and a plus for any other included constraint. The members of a `sameDish` chip SHALL be separated by a thin vertical rule, and the members of an `anyOf` chip by an "o". A chip SHALL be olive when all its members are `include`, terracotta when all are `exclude`, and ochre when it mixes both, and in a mixed chip each member SHALL keep the colour of its polarity. The border SHALL be solid when any member is hard and dashed when all are soft, and in a chip with both, each soft member SHALL be underlined with a dashed line. A member with a meal SHALL show "· comida" or "· cena" after it, once at the end when every member of the chip has the same meal. A long term SHALL wrap, never be cut. Each chip SHALL have a text for screen readers: "En el mismo plato: " for `sameDish` and "Una de: " for `anyOf`, then each member as "excluido: " for `exclude` or "atributo: " for an included `attribute`, the term, ", obligatorio" or ", preferencia", and ", en la comida" or ", en la cena", with the members joined by " y " for `sameDish` and " o " for `anyOf`. The icons and separators SHALL be hidden from screen readers.

#### Scenario: One literal constraint
- **WHEN** the structure has only the soft literal `garbanzos` with polarity `include`
- **THEN** one olive chip with a dashed border shows a plus and "garbanzos", and its screen reader text is "garbanzos, preferencia"

#### Scenario: An included attribute with a meal
- **WHEN** the structure has only the soft attribute `sencillas` with polarity `include` and meal `dinner`
- **THEN** one olive chip shows a sparkles icon, "sencillas" and "· cena", and its screen reader text is "atributo: sencillas, preferencia, en la cena"

#### Scenario: A hard exclusion
- **WHEN** the structure has only the hard exclusion `cerdo`
- **THEN** one terracotta chip with a solid border shows a minus and "cerdo", and its screen reader text is "excluido: cerdo, obligatorio"

#### Scenario: An excluded fuzzy constraint
- **WHEN** the structure has only the fuzzy constraint `fritos` with polarity `exclude`
- **THEN** its chip is terracotta and shows a minus

#### Scenario: A same-dish group with both polarities
- **WHEN** `arroz` (include) and the exclusion `marisco` are a `sameDish` group, and `pollo` (include) is in no group
- **THEN** two chips are shown: an ochre one with "arroz" (plus, olive) and "marisco" (minus, terracotta) separated by a vertical rule, read as "En el mismo plato: arroz, preferencia y excluido: marisco, preferencia", and an olive one with "pollo"

#### Scenario: An any-of group
- **WHEN** `lubina` and `dorada` are an `anyOf` group
- **THEN** one olive chip shows "lubina", an "o" and "dorada", read as "Una de: lubina, preferencia o dorada, preferencia"

#### Scenario: A group with a hard and a soft member
- **WHEN** a `sameDish` group has the hard `arroz` and the soft `verduras`
- **THEN** its border is solid and only "verduras" is underlined with a dashed line

#### Scenario: A group with one meal
- **WHEN** both members of a `sameDish` group have meal `dinner`
- **THEN** the chip shows "· cena" once, after the last member

#### Scenario: A group with different meals
- **WHEN** the members of a `sameDish` group have meals `lunch` and `dinner`
- **THEN** each member shows its own suffix

#### Scenario: The chips cannot be operated
- **WHEN** the chips are shown
- **THEN** none of them is a button, a link or an input, and none has a remove control

### Requirement: Candidate cards with evidence

Each menu of the ranking SHALL be shown as a card with its rank, "Menú N" and one evidence line per unit of the request, in the order of the chips. An evidence line SHALL name the terms of its unit and, when the search gave a dish for it, the day, the meal and the name of that dish, as "Martes, comida · <dish name>". A unit with no dish SHALL say "no aparece en la semana" when all its members are `exclude`, and "ningún plato" otherwise, with a cross instead of a check. The terms of a line SHALL be olive for an `include` member, an included `attribute` among them, and terracotta for an `exclude` member. The cards SHALL have no title, no explanation and no action.

#### Scenario: A unit covered by a dish
- **WHEN** the unit of `garbanzos` has as evidence the lunch dish "Garbanzos con espinacas" of Tuesday
- **THEN** the card shows a check, "garbanzos" and "Martes, comida · Garbanzos con espinacas"

#### Scenario: A week-wide exclusion
- **WHEN** the unit of the exclusion `cerdo`, in no group, has no dish
- **THEN** the card shows a check, "cerdo" and "no aparece en la semana"

#### Scenario: A soft constraint no dish covers
- **WHEN** the unit of the included `salmón` has no dish
- **THEN** the card shows a cross, "salmón" and "ningún plato"

#### Scenario: Cards have no actions
- **WHEN** the cards are shown
- **THEN** no card has a title, an explanation or a button

### Requirement: No menu fits

When the search gives a ranking with no menu, the page SHALL say "Ningún menú encaja con lo que has pedido." under the chips and SHALL show no card.

#### Scenario: No menu fits
- **WHEN** the search gives a structure and an empty ranking
- **THEN** the page shows the chips, says "Ningún menú encaja con lo que has pedido." and shows no card

### Requirement: Search messages

When a search gives no ranking, the page SHALL show one message for its outcome and no chips or cards, and the message SHALL be announced to screen readers:

| Outcome | Message |
|---|---|
| empty request | "Escribe qué te apetece." |
| request longer than 300 characters | "La petición es demasiado larga: como mucho 300 caracteres." |
| rejected request | "Eso no parece una petición de menús. Prueba a decir qué te apetece comer." |
| answer that does not validate, or nothing to search | "No he sabido entender la petición. Prueba a escribirla de otra forma." |
| daily limit reached | "Hoy ya no se pueden hacer más búsquedas. Vuelve a intentarlo mañana." |
| any failure of the system | "No se ha podido buscar. Inténtalo de nuevo." |

#### Scenario: Empty request
- **WHEN** a signed-in user sends a request that is empty or only spaces
- **THEN** the page says "Escribe qué te apetece." and no search runs

#### Scenario: Empty request with JavaScript
- **WHEN** a signed-in user with JavaScript sends a request that is empty or only spaces
- **THEN** the page says "Escribe qué te apetece." at once, no request is sent to the server and no breadcrumb is added

#### Scenario: Request too long
- **WHEN** a signed-in user sends a request of 301 characters
- **THEN** the page says "La petición es demasiado larga: como mucho 300 caracteres." and no search runs

#### Scenario: Rejected request
- **WHEN** the search returns a rejection
- **THEN** the page says "Eso no parece una petición de menús. Prueba a decir qué te apetece comer."

#### Scenario: Nothing to search
- **WHEN** the search returns `nothing-to-search` or `invalid-answer`
- **THEN** the page says "No he sabido entender la petición. Prueba a escribirla de otra forma."

#### Scenario: Daily limit reached
- **WHEN** the search returns `llm-limit-reached`
- **THEN** the page says "Hoy ya no se pueden hacer más búsquedas. Vuelve a intentarlo mañana."

#### Scenario: Failure of the system
- **WHEN** the search returns `decomposer-failed`, `embedding-failed`, `search-failed`, `index-not-loaded` or `invalid-request`
- **THEN** the page says "No se ha podido buscar. Inténtalo de nuevo."

### Requirement: Searching needs a session and trusts only the session

The action behind the search box SHALL check the session before it reads the request. Without a valid session it SHALL run no search and SHALL send the request to `/login`. It SHALL read one field, the text of the request. A missing field, or a field that is not text, SHALL be treated as an empty request. Every other field SHALL be ignored.

#### Scenario: Searching without a session
- **WHEN** a request to the search action carries no valid session
- **THEN** no search runs, the daily LLM bucket is not hit, and the response sends the browser to `/login`

#### Scenario: A field that is not text
- **WHEN** a signed-in user posts the search action with a file in place of the request text, or with no request field
- **THEN** no search runs and the page says "Escribe qué te apetece."

#### Scenario: Extra fields are ignored
- **WHEN** a signed-in user posts the search action with the request "garbanzos" and extra fields naming another user and a strategy
- **THEN** the search runs once with "garbanzos" and the web's own strategy, and no other field reaches it
