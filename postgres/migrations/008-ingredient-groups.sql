-- MF-78 (openspec/changes/mf-78-ingredient-groups): canonical food groups for recipe ingredients.
-- One row per classified ingredient name, with empty food_groups array when no group applies.
-- Enables idempotent classification: an ingredient with empty array is not sent to the LLM again.
-- Row-level security is enabled without policies: only the owner role reads and writes (safety-first §2.3, §2.4).

CREATE TABLE ingredient_group (
  ingredient_name text PRIMARY KEY,
  food_groups text[] NOT NULL,
  model text NOT NULL
);

ALTER TABLE ingredient_group ENABLE ROW LEVEL SECURITY;
