import type pg from 'pg';
import type {
  DishAddress,
  DishTextMatchOptions,
  DishTextSearch,
  DishTextSearchError,
} from '@/application/ports/dish-text-search';
import { err, ok, type Result } from '@/shared/result';
import { describeDatabaseError } from '@/infrastructure/postgres/describe-database-error';

// The term is a bind parameter read by `phraseto_tsquery`, which keeps its words in order and drops operators and
// punctuation, so a term is never query syntax (design D4). A stopword-only term gives an empty query and matches
// nothing. The phrase is looked for in one field at a time, so it never runs from one ingredient into the next.
// Unless disabled ($2 = false, e.g. for week-wide exclusions per MF-72), matches also check ingredient food groups.
const SELECT_MATCHES = `
  SELECT d.menu_number AS menu, d.day, d.type AS meal, d.position
  FROM menu_dish d
  JOIN recipe r ON r.key = d.recipe_key
  CROSS JOIN phraseto_tsquery('spanish_unaccent', $1) AS q
  WHERE numnode(q) > 0
    AND (to_tsvector('spanish_unaccent', d.name) @@ q
      OR to_tsvector('spanish_unaccent', r.title) @@ q
      OR EXISTS (SELECT 1 FROM recipe_ingredient i
                 WHERE i.recipe_key = r.key AND to_tsvector('spanish_unaccent', i.name) @@ q)
      OR ($2::boolean AND EXISTS (
           SELECT 1 FROM recipe_ingredient i
           JOIN ingredient_group g ON g.ingredient_name = i.name
           CROSS JOIN LATERAL unnest(g.food_groups) AS fg
           WHERE i.recipe_key = r.key AND to_tsvector('spanish_unaccent', fg) @@ q
         )))
  ORDER BY d.menu_number, d.day, d.type, d.position`;

/** The lexical match of a term with Postgres full-text search, in Spanish and without accents. */
export class PostgresDishTextSearch implements DishTextSearch {
  constructor(private readonly pool: pg.Pool) {}

  async matches(term: string, options?: DishTextMatchOptions): Promise<Result<DishAddress[], DishTextSearchError>> {
    const includeIngredientGroups = options?.includeIngredientGroups ?? true;
    try {
      const { rows } = await this.pool.query<DishAddress>(SELECT_MATCHES, [term, includeIngredientGroups]);
      return ok(rows);
    } catch (error) {
      return err({ kind: 'text-search-failed', reason: describeDatabaseError(error) });
    }
  }
}
