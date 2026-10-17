## ADDED Requirements

### Requirement: The week is validated

The system SHALL accept as the week of a choice only `current` (this week) or `next` (next week). Anything else, a date among it, SHALL be refused as an invalid week, and nothing SHALL be stored.

#### Scenario: A week that is not current or next
- **WHEN** a user chooses menu 12 for the week `"2026-10-19"`, `"last"`, `"CURRENT"`, `1` or no value
- **THEN** the choice is refused as an invalid week and no selection is stored

### Requirement: This week is locked once next week is chosen

When the user has a selection starting next Monday, the system SHALL refuse a choice for this week as a locked week and SHALL store nothing, whether this week has a menu or not. A choice for next week SHALL still be accepted.

#### Scenario: Changing this week after choosing next week
- **WHEN** a user with menu 3 from 2026-10-05 and menu 12 from 2026-10-12 chooses menu 20 for this week on Thursday 2026-10-08
- **THEN** the choice is refused as a locked week, and both selections are unchanged

#### Scenario: Filling an empty week after choosing next week
- **WHEN** a user whose only selection is menu 12 from 2026-10-12 chooses menu 20 for this week on Thursday 2026-10-08
- **THEN** the choice is refused as a locked week and no selection is stored

#### Scenario: Next week can still be changed
- **WHEN** the same user chooses menu 20 for next week
- **THEN** menu 20 is stored from 2026-10-12 in place of menu 12

### Requirement: The week a choice starts on by default

For a user, the system SHALL suggest one of the two weeks: this week when it is empty and not locked, and otherwise next week.

#### Scenario: Nothing chosen
- **WHEN** on Wednesday 2026-10-07 a user has no selections
- **THEN** the suggested week is this week

#### Scenario: This week chosen
- **WHEN** on Wednesday 2026-10-07 a user's only selection is menu 3 from 2026-10-05
- **THEN** the suggested week is next week

#### Scenario: Only next week chosen
- **WHEN** on Wednesday 2026-10-07 a user's only selection is menu 12 from 2026-10-12
- **THEN** the suggested week is next week, because this week is locked

#### Scenario: Both weeks chosen
- **WHEN** on Wednesday 2026-10-07 a user has menu 3 from 2026-10-05 and menu 12 from 2026-10-12
- **THEN** the suggested week is next week

## MODIFIED Requirements

### Requirement: A menu starts on a Monday the system computes

When a user chooses a menu, the system SHALL store a selection with the user, the menu number, the moment of the choice and a start date. The user SHALL choose the week, this week or next week, and the start date SHALL be that week's Monday, computed on the server from today's date. Today SHALL be the calendar date in Europe/Madrid. The start date SHALL NOT be read from the request.

#### Scenario: Choosing in a week with no menu
- **WHEN** a user with no selections chooses menu 12 for this week on Wednesday 2026-10-07
- **THEN** a selection of menu 12 starting on Monday 2026-10-05 is stored for that user

#### Scenario: Choosing on a Monday with no menu
- **WHEN** a user with no selection starting on 2026-10-05 chooses menu 12 for this week on Monday 2026-10-05
- **THEN** the selection starts on 2026-10-05

#### Scenario: Choosing while a menu is active
- **WHEN** a user whose selection of menu 3 starts on 2026-10-05 chooses menu 12 for next week on Friday 2026-10-09
- **THEN** a selection of menu 12 starting on Monday 2026-10-12 is stored, and the selection of menu 3 is unchanged

#### Scenario: Choosing next week with this week empty
- **WHEN** a user with no selections chooses menu 12 for next week on Wednesday 2026-10-07
- **THEN** a selection of menu 12 starting on Monday 2026-10-12 is stored, and this week stays empty

#### Scenario: Today is the date in Madrid
- **WHEN** a user with no selections chooses a menu for this week at 00:30 of Monday 2026-10-12 in Madrid, which is still Sunday in UTC
- **THEN** the selection starts on 2026-10-12

#### Scenario: The stored start date is always a Monday
- **WHEN** anything tries to store a selection whose start date is not a Monday
- **THEN** the database refuses it

### Requirement: Choosing again for the same Monday replaces the choice

A user SHALL have at most one selection per start date. When the computed start date already has a selection of that user, the new choice SHALL replace it: the earlier selection SHALL no longer exist and the new one SHALL have a new identity. Selections of other start dates SHALL be kept.

#### Scenario: Changing next week's menu
- **WHEN** a user whose selections start on 2026-10-05 (menu 3) and 2026-10-12 (menu 12) chooses menu 20 for next week on Saturday 2026-10-10
- **THEN** the user's selections are menu 3 from 2026-10-05 and menu 20 from 2026-10-12, and the selection of menu 12 no longer exists

#### Scenario: Changing this week's menu
- **WHEN** a user whose only selection is menu 3 from 2026-10-05 chooses menu 20 for this week on Wednesday 2026-10-07
- **THEN** the user's only selection is menu 20 from 2026-10-05, and the selection of menu 3 no longer exists

#### Scenario: Past selections are kept
- **WHEN** a user with a selection starting on 2026-09-28 chooses a menu for this week on 2026-10-07
- **THEN** the selection starting on 2026-09-28 still exists

### Requirement: Selections belong to their user

Every selection SHALL belong to the user given by the caller, which the web adapter takes from the session. Reading or choosing SHALL see and change only that user's selections.

#### Scenario: Another user's selections are invisible
- **WHEN** user A has menu 3 from 2026-10-05 and user B, with no selections, asks for theirs on 2026-10-07
- **THEN** user B has no active menu and no current shopping list

#### Scenario: Another user's selection does not move the start date
- **WHEN** user A has menu 3 from 2026-10-05 and user B, with no selections, chooses menu 12 for this week on 2026-10-07
- **THEN** user B's selection starts on 2026-10-05, and user A's selection is unchanged

#### Scenario: Another user's next week does not lock this week
- **WHEN** user A has menu 12 from 2026-10-12 and user B, with no selections, chooses menu 3 for this week on 2026-10-07
- **THEN** user B's selection of menu 3 starts on 2026-10-05
