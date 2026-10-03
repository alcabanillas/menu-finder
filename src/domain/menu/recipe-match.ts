import { toComparableName } from '@/domain/menu/comparable-name';

// Only a full match resolves: every significant word of the dish must be in the
// file name. A partial match is reported as unresolved for manual review
// instead of being accepted silently (MF-11, task 9.3).
const MATCH_THRESHOLD = 1;

// Breakfast recipes share their folder with the menu's dishes but are out of
// scope (only lunch and dinner are parsed); matching them only adds noise.
// Some folders truncate these file names, so they are compared by prefix.
const BREAKFAST_RECIPE_PREFIXES = [
  'tostada integral con hummus y hojas de espinacas',
  'tostada integral con un poco de aceite de oliva virgen',
];

export type DishToResolve = { name: string; hasRecipeMark: boolean };

export type DishResolution =
  | { status: 'resolved'; recipe: string; score: number }
  | { status: 'unresolved'; discarded: { recipe: string; score: number } | null }
  | { status: 'unmarked' };

/** Whether a recipe file can be matched to a dish: excluded breakfast recipes cannot. */
export const isRecipeCandidate = (recipeFile: string): boolean => !isBreakfastRecipe(toComparableName(recipeFile));

/**
 * Resolves a dish to one of its menu folder's recipe files. Only dishes the
 * PDF marks with `*` are matched; the best candidate (first one on ties) is
 * accepted when its score reaches MATCH_THRESHOLD, and is otherwise kept as
 * discarded so the QA report can show it without presenting it as a match.
 */
export function resolveDish(dish: DishToResolve, recipeFiles: readonly string[]): DishResolution {
  if (!dish.hasRecipeMark) return { status: 'unmarked' };

  const dishWords = significantWords(toComparableName(dish.name));
  let best: { recipe: string; score: number } | null = null;
  for (const recipe of recipeFiles) {
    const candidateName = toComparableName(recipe);
    if (isBreakfastRecipe(candidateName)) continue;
    const score = containmentScore(dishWords, candidateName);
    if (score > (best?.score ?? 0)) best = { recipe, score };
  }

  if (best && best.score >= MATCH_THRESHOLD) return { status: 'resolved', ...best };
  return { status: 'unresolved', discarded: best };
}

function isBreakfastRecipe(comparableName: string): boolean {
  return BREAKFAST_RECIPE_PREFIXES.some((prefix) => comparableName.startsWith(prefix));
}

function significantWords(comparableName: string): Set<string> {
  return new Set(comparableName.split(' ').filter((word) => word.length > 2));
}

/** Fraction of the dish's significant words that also appear in the candidate's name. */
function containmentScore(dishWords: Set<string>, candidateName: string): number {
  const candidateWords = significantWords(candidateName);
  if (dishWords.size === 0 || candidateWords.size === 0) return 0;
  let shared = 0;
  for (const word of dishWords) if (candidateWords.has(word)) shared += 1;
  return shared / dishWords.size;
}
