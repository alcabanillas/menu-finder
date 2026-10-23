# Spec Delta

## MODIFIED Requirements

### Requirement: Search messages

When a search gives no ranking, the page SHALL show one message for its outcome and no chips or cards, and the message SHALL be announced to screen readers:

| Outcome | Message |
|---|---|
| empty request | "Escribe qué te apetece." |
| request longer than 300 characters | "La petición es demasiado larga: como mucho 300 caracteres." |
| request rejected as `out-of-catalog` | "Los menús solo tienen comidas y cenas: no hay postres, desayunos ni bebidas." |
| request rejected with any other category | "Eso no parece una petición de menús. Prueba a decir qué te apetece comer." |
| answer that does not validate, or nothing to search | "No he sabido entender la petición. Prueba a escribirla de otra forma." |
| daily limit reached | "Hoy ya no se pueden hacer más búsquedas. Vuelve a intentarlo mañana." |
| any failure of the system | "No se ha podido buscar. Inténtalo de nuevo." |

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
