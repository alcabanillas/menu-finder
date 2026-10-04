## MODIFIED Requirements

### Requirement: Top five and ties
A menu whose score, rounded to two decimals, is below 0.6 SHALL NOT be ranked: with two units both must count, with three two are enough. The minimum is the same for every strategy and was fixed before any golden-set result. The search SHALL return at most the five best menus, ordered by score from high to low and, for equal scores (compared to six decimals), by menu number from low to high. For every menu returned it SHALL give the menu number, the score and, for each unit, the dish that gave the best score (the first one in menu order on a tie; none when the best score is 0, because such a dish explains nothing; none for a week-wide exclusion, which no single dish satisfies). It SHALL also give the number of ranked menus that tie with the first one, and every ranked menu, in the same order, with its menu number and score, so that an evaluation can see the ties that go past the fifth menu.

#### Scenario: Five of many
- **WHEN** 12 menus are ranked
- **THEN** five are returned, the best first

#### Scenario: Ties
- **WHEN** menus 3, 7 and 9 score 1 and menu 5 scores 0.8
- **THEN** the order starts 3, 7, 9, and the tie count is 3

#### Scenario: Minimum menu score
- **WHEN** the strategy is `lexical`, the constraints are `pollo`, `brócoli` and `arroz` (not grouped), menu 1 covers two of them and menu 2 covers one
- **THEN** menu 1 is ranked with score 0.67 and menu 2, with score 0.33, is not

#### Scenario: No menu reaches the minimum
- **WHEN** every menu scores below 0.6
- **THEN** the ranking is empty and the tie count is 0

#### Scenario: Fewer than five
- **WHEN** only two menus satisfy the hard constraints
- **THEN** two are returned

#### Scenario: Evidence
- **WHEN** a menu is returned for the constraint `pollo`
- **THEN** it names the dish of that menu with the highest score for `pollo`

#### Scenario: No evidence at score 0
- **WHEN** a menu is returned and every dish of it scores 0 for the constraint `pollo`
- **THEN** it names no dish for that constraint

#### Scenario: Whole ranking
- **WHEN** 12 menus are ranked
- **THEN** five are returned with their evidence, and the whole ranking lists the 12 menu numbers with their scores, in the same order
