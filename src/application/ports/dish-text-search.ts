import type { Day, MealType } from '@/domain/menu/weekly-menu';
import type { Result } from '@/shared/result';

/** Where a dish sits: its menu, its meal and its position in the meal. */
export type DishAddress = { menu: number; day: Day; meal: MealType; position: number };

export type DishTextSearchError = { kind: 'text-search-failed'; reason: string };

/**
 * The lexical match of a term, done by the database (design D4): no existing port reads dish text for matching.
 * The fields of a dish are the menu dish name, the recipe title and each ingredient name.
 */
export interface DishTextSearch {
  /** The dishes with the term as a phrase in one of their fields; none for a term made only of stopwords. */
  matches(term: string): Promise<Result<DishAddress[], DishTextSearchError>>;
}
