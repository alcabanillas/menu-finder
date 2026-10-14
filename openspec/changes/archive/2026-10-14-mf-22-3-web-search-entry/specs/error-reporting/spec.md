## ADDED Requirements

### Requirement: Search failures reach Sentry
A web search from the text of a request SHALL report to Sentry, explicitly, every outcome that is a failure of the system: `decomposer-failed`, `embedding-failed`, `search-failed`, `index-not-loaded` and `llm-limit-reached`. These outcomes are returned as values, not thrown, so no uncaught-error handler sees them. Each event SHALL carry the kind of the failure and, for `decomposer-failed` and `embedding-failed`, the model that failed. It SHALL also carry the reason, if the failure has one, with the API key and the text of the request removed. An event SHALL NOT carry the text of the request, the structure of constraints or any of its terms. Outcomes that answer the user's request are not failures of the system and SHALL NOT be reported: a rejection, a request that is too short or too long, an invalid answer of the model, an invalid structure and a request with nothing to search. The search SHALL return the same outcome whether or not it was reported.

#### Scenario: Decomposer failure reported
- **WHEN** a web search ends in `decomposer-failed`
- **THEN** one event reaches Sentry with the kind `decomposer-failed`, the decomposer model and the reason

#### Scenario: Embedding failure reported
- **WHEN** a web search ends in `embedding-failed`
- **THEN** one event reaches Sentry with the kind `embedding-failed`, the embedding model and the reason

#### Scenario: Database failure reported
- **WHEN** a web search ends in `search-failed`
- **THEN** one event reaches Sentry with the kind `search-failed` and the reason

#### Scenario: Index not loaded reported
- **WHEN** a web search ends in `index-not-loaded`
- **THEN** one event reaches Sentry with the kind `index-not-loaded`

#### Scenario: Daily limit reported
- **WHEN** a web search ends in `llm-limit-reached`
- **THEN** one event reaches Sentry with the kind `llm-limit-reached`

#### Scenario: Key and request removed from the reason
- **WHEN** a failure reason contains the API key and the text of the request
- **THEN** the event's reason contains neither, and no field of the event contains the request text

#### Scenario: User outcomes not reported
- **WHEN** a web search ends in a rejection, `request-too-short`, `request-too-long`, `invalid-answer`, `invalid-request` or `nothing-to-search`
- **THEN** no event reaches Sentry

#### Scenario: Successful search not reported
- **WHEN** a web search returns a ranking
- **THEN** no event reaches Sentry
