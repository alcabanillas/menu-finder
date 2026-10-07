## MODIFIED Requirements

### Requirement: Database content
A save SHALL store the recipes or menus it receives, replacing the stored version of the same recipe file or menu number, and SHALL NOT remove the ones it did not receive. Replacing a menu SHALL replace its meals and dishes and SHALL keep the rows of other tables that point to that menu number, such as its shopping items. Recipes SHALL be stored whole (title, times, ingredients and preparation); menus with their meals and dishes in order; a dish with no recipe file SHALL point to a row with the dish name only, one per distinct name. A menu with a dish whose recipe is not in the database SHALL NOT be saved, and the error SHALL name the menu, the dish and the file. Each save SHALL be one transaction.

#### Scenario: Menu not received is kept
- **WHEN** menus 1 and 2 are stored and a save receives only menu 2
- **THEN** menu 1 is still in the database

#### Scenario: Recipe missing from the database
- **WHEN** a save receives menus 1 and 2 and a dish of menu 2 names a recipe that is not in the database
- **THEN** menu 1 is saved, menu 2 is not, and the error names menu 2, the dish and the file

#### Scenario: Shopping list kept when its menu is replaced
- **WHEN** menu 4 is stored with a shopping list and a save receives menu 4 again
- **THEN** the shopping items of menu 4 are still in the database, unchanged

#### Scenario: Replaced menu loses its old dishes
- **WHEN** menu 4 is stored with two lunch dishes and a save receives menu 4 with one different lunch dish
- **THEN** menu 4 has only the new dish
