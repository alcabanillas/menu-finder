-- MF-43.1 (openspec/changes/mf-43-1-menu-selection): the menus each user chooses and the Monday each one starts on.
-- The dates are the only state: no "current" flag, no history table (design D1). A surrogate id changes when the
-- user replaces the menu of a week, so whatever hangs from a selection does not survive onto another menu.
-- The key to menu is DEFERRABLE INITIALLY DEFERRED (design D3): `pnpm ingest menu` deletes and reinserts the menus in
-- one transaction, so the key is checked at commit, when every menu number exists again. CASCADE would wipe every
-- user's selections on each load, and RESTRICT would make the load fail once anyone has chosen a menu.
-- Row-level security is enabled without policies: only the owner role reads and writes (policies in MF-48).

CREATE TABLE selection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  menu_number integer NOT NULL REFERENCES menu (number) DEFERRABLE INITIALLY DEFERRED,
  selected_at timestamptz NOT NULL DEFAULT now(),
  starts_on date NOT NULL CHECK (EXTRACT(ISODOW FROM starts_on) = 1),
  UNIQUE (user_id, starts_on)
);

ALTER TABLE selection ENABLE ROW LEVEL SECURITY;
