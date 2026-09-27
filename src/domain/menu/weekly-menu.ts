export type Day = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export type MealType = "lunch" | "dinner";

export type MenuDish = {
  /** 1-based order within the menu cell. */
  position: number;
  name: string;
  /** The PDF marks the dish with `*`: it comes with a recipe. */
  hasRecipeMark: boolean;
  /** Recipe file name without extension, until the recipe leg maps it to a recipe id. */
  recipeFile: string | null;
};

export type Meal = { day: Day; type: MealType; dishes: MenuDish[] };

/** Always 14 meals: one per day and meal type, ordered by day and then lunch before dinner. */
export type WeeklyMenu = { number: number; meals: Meal[] };
