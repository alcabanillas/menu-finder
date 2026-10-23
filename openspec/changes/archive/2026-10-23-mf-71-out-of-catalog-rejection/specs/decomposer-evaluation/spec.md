# Spec Delta

## MODIFIED Requirements

### Requirement: Rejections
For each rejection category, the evaluation SHALL give how many rejected requests the model rejected with that category, out of how many there are. It SHALL also give the search requests the model rejected, which are a mistake, and count their expected constraints as not found.

There SHALL be one row per category of spec `request-decomposer`. A rejected trap request SHALL count as a search request rejected by mistake.

#### Scenario: Rejection hit
- **WHEN** the label of X01 is the rejection `gibberish` and the model rejects it as `gibberish`
- **THEN** the `gibberish` row counts one hit

#### Scenario: Other category
- **WHEN** the label is `instruction` and the model rejects the request as `off-topic`
- **THEN** the `instruction` row does not count it as a hit

#### Scenario: Out-of-catalog hit
- **WHEN** the label of X11 is the rejection `out-of-catalog` and the model rejects it as `out-of-catalog`
- **THEN** the `out-of-catalog` row counts one hit

#### Scenario: Search request rejected
- **WHEN** the model rejects a search request with two expected constraints
- **THEN** the request is counted as rejected by mistake and its two constraints as not found

#### Scenario: Trap request rejected
- **WHEN** the model rejects the trap request T01 as `out-of-catalog`
- **THEN** T01 is listed among the search requests rejected by mistake and its constraints count as not found
