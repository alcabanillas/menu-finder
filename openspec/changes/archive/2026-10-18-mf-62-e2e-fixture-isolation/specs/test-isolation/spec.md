## ADDED Requirements

### Requirement: End-to-end fixtures belong to their run

Each run of an end-to-end spec file SHALL seed its menus with numbers and its recipes with keys that no other run uses at the same time, and that are not the numbers of the real menus. A run SHALL delete only the rows it seeded, so two runs of the same spec file at the same time on the test database both pass.

#### Scenario: Two runs get different fixtures
- **WHEN** two runs of the same spec file pick their fixture identifiers
- **THEN** no menu number and no recipe key of one run is used by the other

#### Scenario: Fixture menus are not real menus
- **WHEN** a run picks its menu numbers
- **THEN** every number is a positive integer that fits a PostgreSQL `integer`, and none is a number of the real catalogue (1 to 36)

#### Scenario: The same spec file run three times in parallel
- **WHEN** `pnpm test:e2e e2e/shopping-list.spec.ts --repeat-each=3` runs against the test database
- **THEN** every test passes
