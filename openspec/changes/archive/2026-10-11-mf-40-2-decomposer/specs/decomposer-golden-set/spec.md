## MODIFIED Requirements

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
