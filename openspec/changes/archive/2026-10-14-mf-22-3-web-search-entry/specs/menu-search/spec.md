## MODIFIED Requirements

### Requirement: Failures
A failure of the database or of the embedding service SHALL end the search with an error and SHALL NOT return a partial ranking. A failure of the embedding service SHALL be reported as `embedding-failed`, and a failure of the database as `search-failed`, each with its reason. Error messages SHALL NOT contain the connection string or the key.

#### Scenario: Database unreachable
- **WHEN** the database cannot be reached
- **THEN** the search returns a `search-failed` error with no ranking and no credentials in the text

#### Scenario: Embedding service fails
- **WHEN** the strategy is `semantic` and the embedding service fails
- **THEN** the search returns an `embedding-failed` error with its reason, no ranking and no key in the text
