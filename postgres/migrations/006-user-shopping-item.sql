-- MF-24 (openspec/changes/mf-24-shopping-checklist): the shopping list items each user has ticked in a selection.
-- The ticks hang from the selection, not from the menu: replacing the menu of a week creates a new selection id and
-- drops the ticks with ON DELETE CASCADE, and so does deleting the account (design D5). Unticking stores
-- `checked = false`, so the table keeps the column the data model names.
-- There is deliberately NO key to shopping_item: `pnpm ingest` deletes and reinserts those rows, so a key would
-- either cascade and wipe every user's ticks or block the load. The use case validates the position instead.
-- Row-level security is enabled without policies: only the owner role reads and writes (policies in MF-48).

CREATE TABLE user_shopping_item (
  selection_id uuid NOT NULL REFERENCES selection (id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position > 0),
  checked boolean NOT NULL,
  PRIMARY KEY (selection_id, position)
);

ALTER TABLE user_shopping_item ENABLE ROW LEVEL SECURITY;
