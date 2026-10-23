# decomposer-golden-set Specification

## Purpose

Holds the golden set of natural-language requests and their expected constraints, labelled before the decomposer exists, that MF-40.3 uses to measure the decomposer's precision and recall per constraint and per type.

## Requirements

### Requirement: Requests
`evals/decomposer/golden-set.json` SHALL hold every query of `evals/retrieval/queries.json`, kept or withdrawn, with the same `id` and `text`, plus the long requests `R01`–`R07`, the rejected requests `X01`–`X15` and the trap requests `T01`–`T04`. Each request SHALL have a unique `id`, a non-empty `text` and an `origin`: `retrieval-golden-set` for a reused query, `llm-blind` for a long request, `llm-blind-rejected` for a rejected request, `catalog-trap` for a trap request.

#### Scenario: Every retrieval query is reused
- **WHEN** the golden set is validated
- **THEN** every id in `evals/retrieval/queries.json` is present with the same text, and the check passes

#### Scenario: Retrieval query missing
- **WHEN** the golden set lacks the retrieval query `L06`
- **THEN** validation fails naming `L06`

#### Scenario: Text differs from retrieval
- **WHEN** the golden set has `F01` with a text that differs from `F01` in `evals/retrieval/queries.json`
- **THEN** validation fails naming `F01` and the field `text`

#### Scenario: Duplicate id
- **WHEN** two requests have the id `R03`
- **THEN** validation fails naming `R03`

#### Scenario: Unknown origin
- **WHEN** a request has the origin `manual`
- **THEN** validation fails naming the request and the field `origin`

### Requirement: Constraint schema
Each search request SHALL have a list of constraints, which MAY be empty when the request expresses nothing that the four types can hold. Each constraint SHALL have:
- an `id` unique within its request;
- a `type`: `literal`, `exclusion`, `attribute` or `fuzzy`;
- a `term`: the words of the request that express the constraint, lowercased, without the words that only set the slot;
- a `polarity`: `include` or `exclude`;
- a boolean `hard`;
- an optional `slot`: `lunch` or `dinner`.

A constraint of type `exclusion` SHALL have polarity `exclude`. No other field SHALL be present, in a constraint or in a request.

#### Scenario: Valid request
- **WHEN** `C05` "arroz sin carne" has an include literal `arroz` and an exclude exclusion `carne`, grouped in the same dish
- **THEN** validation passes

#### Scenario: Unknown type
- **WHEN** a constraint has the type `hypernym`
- **THEN** validation fails naming the request, the constraint and the field `type`

#### Scenario: Exclusion with polarity include
- **WHEN** a constraint of type `exclusion` has the polarity `include`
- **THEN** validation fails naming the request and the constraint

#### Scenario: Extra field
- **WHEN** a constraint has the field `group`
- **THEN** validation fails naming the request, the constraint and `group`

#### Scenario: Term not in the request
- **WHEN** the `term` of a constraint does not appear in the lowercased `text` of its request
- **THEN** validation fails naming the request and the term

### Requirement: Rejected requests
The golden set SHALL hold requests whose expected answer is a rejection, because they are not a search for menus (BUS-descomponedor). A rejected request SHALL have a unique `id`, a non-empty `text`, the origin `llm-blind-rejected` and a `rejection` category: `gibberish`, `off-topic`, `instruction`, `not-a-search` or `out-of-catalog`. It SHALL have no `constraints`, `sameDish` or `anyOf`. A request of any other origin SHALL NOT have a `rejection`.

A rejection is not an empty list of constraints: a request with `"constraints": []` is a search that the four types cannot hold, and the decomposer answers it with an empty structure, not with a rejection.

`out-of-catalog` is a request that only asks for a kind of food the menus do not have: desserts, breakfasts or drinks. A request that also asks for something the menus can have is a search.

#### Scenario: Valid rejected request
- **WHEN** `X01` "asdfgh" has the origin `llm-blind-rejected` and the rejection `gibberish`
- **THEN** validation passes

#### Scenario: Valid out-of-catalog request
- **WHEN** `X11` has the origin `llm-blind-rejected` and the rejection `out-of-catalog`
- **THEN** validation passes

#### Scenario: Unknown category
- **WHEN** a rejected request has the rejection `spam`
- **THEN** validation fails naming the request and the field `rejection`

#### Scenario: Rejected request without category
- **WHEN** a request with the origin `llm-blind-rejected` has no `rejection`
- **THEN** validation fails naming the request and the field `rejection`

#### Scenario: Rejected request with constraints
- **WHEN** a request with the origin `llm-blind-rejected` has a `constraints` list
- **THEN** validation fails naming the request and the field `constraints`

#### Scenario: Search request with a rejection
- **WHEN** `L06`, with the origin `retrieval-golden-set`, has the rejection `off-topic`
- **THEN** validation fails naming `L06` and the field `rejection`

#### Scenario: Empty search is not a rejection
- **WHEN** `A12` "platos para el finde" has the origin `retrieval-golden-set`, empty `constraints`, `sameDish` and `anyOf`, and no `rejection`
- **THEN** validation passes

### Requirement: Trap requests
The golden set SHALL hold trap requests: searches that sound like something the menus do not have, a dessert, a breakfast or a drink, but name a dish or a flavour the catalog has. A trap request SHALL have the origin `catalog-trap`, the shape and rules of a search request, at least one constraint, and no `rejection`. Its expected answer is a structure, never a rejection.

#### Scenario: Valid trap request
- **WHEN** `T01` "tostadas de calabaza" has the origin `catalog-trap` and an include literal `tostadas de calabaza`
- **THEN** validation passes

#### Scenario: Trap request with a rejection
- **WHEN** `T02`, with the origin `catalog-trap`, has the rejection `out-of-catalog`
- **THEN** validation fails naming `T02` and the field `rejection`

#### Scenario: Trap request without constraints
- **WHEN** `T03`, with the origin `catalog-trap`, has an empty `constraints` list
- **THEN** validation fails naming `T03` and the field `constraints`

### Requirement: Same-dish groups
Each search request SHALL have a list `sameDish` of groups, each a list of two or more constraint ids of that request. A group SHALL mean that one dish must satisfy all its constraints (BUS-superficie-consulta (a)). An exclusion in a group SHALL apply to that dish; an exclusion outside every group SHALL apply to the week (BUS-superficie-consulta (b)). A constraint SHALL belong to at most one group.

#### Scenario: Group with an unknown constraint
- **WHEN** a group of `C04` names the constraint `c9` and `C04` has no such constraint
- **THEN** validation fails naming `C04` and `c9`

#### Scenario: Group of one
- **WHEN** a group has a single constraint id
- **THEN** validation fails naming the request

#### Scenario: Constraint in two groups
- **WHEN** a constraint id appears in two groups of the same request
- **THEN** validation fails naming the request and the constraint

### Requirement: Alternatives groups
Each search request SHALL have a list `anyOf` of groups, each a list of two or more constraint ids of that request. A group SHALL mean one condition that a dish satisfies by meeting any of its constraints ("garbanzos o lentejas", BUS-superficie-consulta (a)). Every constraint in a group SHALL have polarity `include`. A constraint SHALL belong to at most one `anyOf` group, and SHALL NOT belong to both an `anyOf` group and a `sameDish` group.

#### Scenario: Alternatives group of one
- **WHEN** an `anyOf` group has a single constraint id
- **THEN** validation fails naming the request and the field `anyOf`

#### Scenario: Alternatives group with an unknown constraint
- **WHEN** an `anyOf` group of `R02` names the constraint `c9` and `R02` has no such constraint
- **THEN** validation fails naming `R02` and `c9`

#### Scenario: Excluded alternative
- **WHEN** a constraint in an `anyOf` group has the polarity `exclude`
- **THEN** validation fails naming the request and the constraint

#### Scenario: Constraint in both kinds of group
- **WHEN** a constraint id appears in an `anyOf` group and in a `sameDish` group of the same request
- **THEN** validation fails naming the request and the constraint

### Requirement: Composition
The golden set SHALL have exactly 80 requests: the 54 reused queries, 7 long requests, 15 rejected requests and 4 trap requests. Five of the rejected requests SHALL have the rejection `out-of-catalog`. Each long request SHALL have at least three constraints and at least two different types.

#### Scenario: Long request too simple
- **WHEN** `R02` has two constraints
- **THEN** validation fails naming `R02`

#### Scenario: Wrong number of rejected requests
- **WHEN** the golden set has 14 rejected requests
- **THEN** validation fails with a message that expects 15 rejected requests

#### Scenario: Wrong number of out-of-catalog requests
- **WHEN** the golden set has 15 rejected requests and four of them are `out-of-catalog`
- **THEN** validation fails with a message that expects 5 `out-of-catalog` requests

#### Scenario: Wrong number of trap requests
- **WHEN** the golden set has 3 trap requests
- **THEN** validation fails with a message that expects 4 trap requests

### Requirement: Validation in CI
The golden set SHALL be validated by an automated test that runs with the unit tests, and so in the pre-commit hook and in CI. A failure SHALL list every error found, each naming the request and, where it applies, the constraint and the field.

#### Scenario: Several errors at once
- **WHEN** one request has a duplicate id and another an unknown type
- **THEN** the test fails and reports both errors
