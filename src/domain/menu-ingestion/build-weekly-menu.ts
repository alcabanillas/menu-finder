import type { Day, Meal, MealType, WeeklyMenu } from "../menu/weekly-menu";
import { isFiller } from "./filler";
import { isRecipeCandidate, resolveDish, type DishResolution } from "./recipe-match";
import type { SourceDish, SourceMenu } from "./source-menu";

const DAYS: readonly Day[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const MEAL_TYPES: readonly MealType[] = ["lunch", "dinner"];

/** A kept dish with its resolution: the evidence the QA report needs and the menu does not store. */
export type DishOutcome = { day: Day; type: MealType; position: number; name: string; resolution: DishResolution };

export type MenuCounts = {
  emptySlots: number;
  multiDishSlots: number;
  resolved: number;
  unmarked: number;
  unresolved: number;
  unclaimedRecipeFiles: number;
};

export type BuiltWeeklyMenu = { menu: WeeklyMenu; dishes: DishOutcome[]; counts: MenuCounts };

const isKept = (dish: SourceDish): boolean => dish.hasRecipeMark || !isFiller(dish.name);

/**
 * Builds the weekly menu from what a source read: always fourteen meals,
 * unmarked filler dropped, positions following source order, and each marked
 * dish resolved against the menu's recipe files. Every count is taken after
 * dropping filler.
 */
export function buildWeeklyMenu(number: number, source: SourceMenu, recipeFiles: readonly string[]): BuiltWeeklyMenu {
  const dishes: DishOutcome[] = [];
  const counts: MenuCounts = {
    emptySlots: 0,
    multiDishSlots: 0,
    resolved: 0,
    unmarked: 0,
    unresolved: 0,
    unclaimedRecipeFiles: 0,
  };
  const claimed = new Set<string>();

  const meals: Meal[] = DAYS.flatMap((day) =>
    MEAL_TYPES.map((type): Meal => {
      const kept = source.meals
        .filter((meal) => meal.day === day && meal.type === type)
        .flatMap((meal) => meal.dishes)
        .filter(isKept);
      if (kept.length === 0) counts.emptySlots++;
      if (kept.length > 1) counts.multiDishSlots++;

      return {
        day,
        type,
        dishes: kept.map((dish, index) => {
          const position = index + 1;
          const resolution = resolveDish(dish, recipeFiles);
          counts[resolution.status]++;
          if (resolution.status === "resolved") claimed.add(resolution.recipe);
          dishes.push({ day, type, position, name: dish.name, resolution });
          return {
            position,
            name: dish.name,
            hasRecipeMark: dish.hasRecipeMark,
            recipeFile: resolution.status === "resolved" ? resolution.recipe : null,
          };
        }),
      };
    }),
  );

  counts.unclaimedRecipeFiles = [...new Set(recipeFiles)].filter(
    (file) => isRecipeCandidate(file) && !claimed.has(file),
  ).length;
  return { menu: { number, meals }, dishes, counts };
}
