import type { Day, MealType } from "../menu/weekly-menu";

/** A dish as the source lists it: its name and whether the source marks it as having a recipe. */
export type SourceDish = { name: string; hasRecipeMark: boolean };

/** One meal as the source lists it, with its dishes in source order. */
export type SourceMeal = { day: Day; type: MealType; dishes: SourceDish[] };

/**
 * A menu as any source yields it, before domain rules apply: filler is not
 * dropped and no recipe is resolved. Meals the source does not list may be
 * missing; the source's layout (table, rows, pages) is already gone.
 */
export type SourceMenu = { meals: SourceMeal[] };
