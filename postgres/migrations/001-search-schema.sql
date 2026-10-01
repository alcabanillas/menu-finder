-- MF-41 (openspec/changes/mf-41-search-index): the subset of ARQ-modelo-datos the search needs.
-- Natural keys (menu number, recipe file, positions), so that reloading the same files gives the same rows.
-- Every table has row-level security and no policy: only the owner role, used by the CLI, reads and writes.

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

CREATE TABLE menu (
  number integer PRIMARY KEY CHECK (number > 0)
);

CREATE TABLE meal (
  menu_number integer NOT NULL REFERENCES menu (number) ON DELETE CASCADE,
  day text NOT NULL CHECK (day IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  type text NOT NULL CHECK (type IN ('lunch', 'dinner')),
  PRIMARY KEY (menu_number, day, type)
);

-- One row per recipe file (file = key), and one per dish name without recipe file (key `dish:<name>`, no text).
CREATE TABLE recipe (
  key text PRIMARY KEY,
  file text UNIQUE,
  source_menu integer,
  title text NOT NULL,
  total_min integer,
  preparation_min integer,
  cooking_min integer,
  resting_min integer,
  -- One paragraph per element, in order; NULL for a dish without recipe file.
  preparation text[],
  CHECK ((file IS NULL) = (key LIKE 'dish:%'))
);

CREATE TABLE menu_dish (
  menu_number integer NOT NULL,
  day text NOT NULL,
  type text NOT NULL,
  position integer NOT NULL CHECK (position > 0),
  name text NOT NULL,
  has_recipe_mark boolean NOT NULL,
  recipe_key text NOT NULL REFERENCES recipe (key),
  PRIMARY KEY (menu_number, day, type, position),
  FOREIGN KEY (menu_number, day, type) REFERENCES meal (menu_number, day, type) ON DELETE CASCADE
);

CREATE TABLE recipe_ingredient (
  recipe_key text NOT NULL REFERENCES recipe (key) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position > 0),
  name text NOT NULL,
  household_measure text,
  quantity numeric,
  unit text CHECK (unit IN ('g', 'ml', 'kg', 'l')),
  optional boolean NOT NULL,
  PRIMARY KEY (recipe_key, position)
);

-- `variant` is the embedded text (EVAL-golden-sets, ablation (b)); `source` is that text, to know when to recompute.
CREATE TABLE recipe_embedding (
  recipe_key text NOT NULL REFERENCES recipe (key) ON DELETE CASCADE,
  variant text NOT NULL,
  model text NOT NULL,
  dimensions integer NOT NULL CHECK (dimensions = 3072),
  source text NOT NULL,
  embedding vector(3072) NOT NULL,
  PRIMARY KEY (recipe_key, variant)
);

ALTER TABLE menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_dish ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredient ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_embedding ENABLE ROW LEVEL SECURITY;
