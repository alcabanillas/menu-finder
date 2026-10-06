## ADDED Requirements

### Requirement: Integration tests that share a database start from empty tables

A test database SHALL be able to empty all the tables of its own schema, so the tests of one file can share one migrated database without seeing each other's data. Emptying SHALL keep the record of applied migrations, and SHALL NOT touch `public` or any other schema.

#### Scenario: Tables emptied
- **WHEN** a migrated test database has rows in its tables and is emptied
- **THEN** every table of its schema has no rows, except the record of applied migrations, which keeps them

#### Scenario: Usable again after emptying
- **WHEN** a migrated test database is emptied
- **THEN** rows can be written to its tables again, without applying the migrations again

#### Scenario: Other schemas untouched
- **WHEN** a test database is emptied while `public` and another test schema have rows
- **THEN** those rows are still there
