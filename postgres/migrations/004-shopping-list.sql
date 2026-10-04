-- MF-10 (openspec/changes/mf-10-shopping-list-ingestion): shopping list items parsed from nutritionist PDFs.
-- Natural key (menu_number, position) preserves the order of the PDF and makes reloading idempotent.
-- Row-level security is enabled without policies: only the owner role reads and writes.

CREATE TABLE shopping_item (
  menu_number integer NOT NULL REFERENCES menu (number) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position > 0),
  category text NOT NULL,
  name text NOT NULL,
  quantity numeric,
  unit text CHECK (unit IN ('g', 'ml')),
  optional boolean NOT NULL,
  PRIMARY KEY (menu_number, position)
);

ALTER TABLE shopping_item ENABLE ROW LEVEL SECURITY;
