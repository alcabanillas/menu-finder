# menu-selection Specification

## Purpose
Records which of the weekly menus each user has chosen and for which week, computes the Monday the chosen menu starts on, and tells which selection is the active menu and which one gives the current shopping list.

## Requirements

### Requirement: A menu starts on a Monday the system computes

When a user chooses a menu, the system SHALL store a selection with the user, the menu number, the moment of the choice and a start date. The start date SHALL be a Monday computed on the server from today's date: this week's Monday when the user has no selection starting on it, and next Monday when the user has one. Today SHALL be the calendar date in Europe/Madrid. The start date SHALL NOT be read from the request.

#### Scenario: Choosing in a week with no menu
- **WHEN** a user with no selections chooses menu 12 on Wednesday 2026-10-07
- **THEN** a selection of menu 12 starting on Monday 2026-10-05 is stored for that user

#### Scenario: Choosing on a Monday with no menu
- **WHEN** a user with no selection starting on 2026-10-05 chooses menu 12 on Monday 2026-10-05
- **THEN** the selection starts on 2026-10-05

#### Scenario: Choosing while a menu is active
- **WHEN** a user whose selection of menu 3 starts on 2026-10-05 chooses menu 12 on Friday 2026-10-09
- **THEN** a selection of menu 12 starting on Monday 2026-10-12 is stored, and the selection of menu 3 is unchanged

#### Scenario: Today is the date in Madrid
- **WHEN** a user with no selections chooses a menu at 00:30 of Monday 2026-10-12 in Madrid, which is still Sunday in UTC
- **THEN** the selection starts on 2026-10-12

#### Scenario: The stored start date is always a Monday
- **WHEN** anything tries to store a selection whose start date is not a Monday
- **THEN** the database refuses it

### Requirement: Choosing again for the same Monday replaces the choice

A user SHALL have at most one selection per start date. When the computed start date already has a selection of that user, the new choice SHALL replace it: the earlier selection SHALL no longer exist and the new one SHALL have a new identity. Selections of other start dates SHALL be kept.

#### Scenario: Changing next week's menu
- **WHEN** a user whose selections start on 2026-10-05 (menu 3) and 2026-10-12 (menu 12) chooses menu 20 on Saturday 2026-10-10
- **THEN** the user's selections are menu 3 from 2026-10-05 and menu 20 from 2026-10-12, and the selection of menu 12 no longer exists

#### Scenario: Past selections are kept
- **WHEN** a user with a selection starting on 2026-09-28 chooses a menu on 2026-10-07
- **THEN** the selection starting on 2026-09-28 still exists

### Requirement: The active menu and the current shopping list

For a user, the system SHALL return two selections, each possibly none: the **active menu**, the selection whose week (its Monday to the following Sunday) contains today; and the **current shopping list**, the selection starting next Monday if there is one, otherwise the active menu.

#### Scenario: Only this week's menu
- **WHEN** on Thursday 2026-10-08 a user's only selection is menu 3 from 2026-10-05
- **THEN** the active menu is menu 3 and the current shopping list is menu 3

#### Scenario: Next week's menu already chosen
- **WHEN** on Friday 2026-10-09 a user has menu 3 from 2026-10-05 and menu 12 from 2026-10-12
- **THEN** the active menu is menu 3 and the current shopping list is menu 12

#### Scenario: Next week chosen, nothing this week
- **WHEN** on Friday 2026-10-09 a user's only selection is menu 12 from 2026-10-12
- **THEN** there is no active menu and the current shopping list is menu 12

#### Scenario: A menu ends on its Sunday
- **WHEN** a user's only selection is menu 3 from 2026-10-05
- **THEN** on Sunday 2026-10-11 the active menu is menu 3, and on Monday 2026-10-12 there is no active menu and no current shopping list

#### Scenario: A user who never chose
- **WHEN** a user with no selections asks for them
- **THEN** there is no active menu and no current shopping list

### Requirement: The menu number is validated

The system SHALL accept as the menu only a positive integer that is the number of a stored menu. Anything else SHALL be refused with a reason that tells an invalid value from a menu that does not exist, and nothing SHALL be stored.

#### Scenario: Not a positive integer
- **WHEN** a user chooses the menu `"12abc"`, `0`, `-3`, `1.5` or no value
- **THEN** the choice is refused as an invalid menu and no selection is stored

#### Scenario: A menu that does not exist
- **WHEN** a user chooses menu 999 and there is no menu 999
- **THEN** the choice is refused as an unknown menu and no selection is stored

### Requirement: Selections belong to their user

Every selection SHALL belong to the user given by the caller, which the web adapter takes from the session. Reading or choosing SHALL see and change only that user's selections.

#### Scenario: Another user's selections are invisible
- **WHEN** user A has menu 3 from 2026-10-05 and user B, with no selections, asks for theirs on 2026-10-07
- **THEN** user B has no active menu and no current shopping list

#### Scenario: Another user's selection does not move the start date
- **WHEN** user A has menu 3 from 2026-10-05 and user B, with no selections, chooses menu 12 on 2026-10-07
- **THEN** user B's selection starts on 2026-10-05, and user A's selection is unchanged

### Requirement: Selections survive re-loading the menus

Loading the menus again with the ingestion command SHALL NOT delete or change any selection, and SHALL NOT fail because selections point to the menus it reloads.

#### Scenario: Re-ingesting the menus
- **WHEN** a user has a selection of menu 3 and the menus, menu 3 included, are loaded again
- **THEN** the load succeeds and the selection of menu 3 still exists
