-- MF-42 (openspec/changes/mf-42-menu-search, design D4): what the lexical match of a term needs.
-- The dish text is computed in each query. This configuration is Spanish with the accents removed before
-- stemming, so that "salmón" and "SALMON" give the same lexeme and no query calls unaccent() by hand.
-- 002 is reserved for a parallel change; this migration needs only 001.

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

CREATE TEXT SEARCH CONFIGURATION spanish_unaccent (COPY = pg_catalog.spanish);

ALTER TEXT SEARCH CONFIGURATION spanish_unaccent
  ALTER MAPPING FOR hword, hword_part, word WITH public.unaccent, spanish_stem;
