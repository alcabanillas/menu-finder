# Spec Delta

## MODIFIED Requirements

### Requirement: Decomposition
The answer of the model SHALL be either a structure or a rejection. A structure SHALL have the shape of `SearchRequestDto` (spec `menu-search`, "Request structure"): constraints with the four types, `term`, `polarity`, `hard`, an optional `slot`, and the groups `sameDish` and `anyOf`. A rejection SHALL have one category: `gibberish`, `off-topic`, `instruction`, `not-a-search` or `out-of-catalog` (spec `decomposer-golden-set`, "Rejected requests").

A structure with constraints SHALL pass the validation of the search (`parseSearchRequest`), and the `term` of every constraint SHALL appear in the request text, both trimmed and compared in lowercase. A structure with no constraints SHALL be a valid answer: the request is a search that the four types cannot hold, not a rejection.

#### Scenario: Structure
- **WHEN** the model answers "cenas rápidas sin cerdo" with an attribute `rápidas` for dinner and an exclusion `cerdo`
- **THEN** the decomposer returns that structure

#### Scenario: Rejection
- **WHEN** the model answers "asdfgh" with the rejection `gibberish`
- **THEN** the decomposer returns a rejection with the category `gibberish`

#### Scenario: Out-of-catalog rejection
- **WHEN** the model answers "una tarta para el cumpleaños" with the rejection `out-of-catalog`
- **THEN** the decomposer returns a rejection with the category `out-of-catalog`

#### Scenario: Empty structure
- **WHEN** the model answers "platos para el finde" with no constraints and no groups
- **THEN** the decomposer returns the empty structure, not a rejection
