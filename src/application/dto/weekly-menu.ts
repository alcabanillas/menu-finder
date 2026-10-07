/** Days and meals as the menu names them, so the web can label them in Spanish. */
export type DayDto = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

/** An ingredient of a recipe: its household measure, and its quantity and unit when the source gives them. */
export type RecipeIngredientDto = {
  name: string;
  householdMeasure: string | null;
  quantity: number | null;
  unit: string | null;
  optional: boolean;
};

/** A recipe as the card shows it: times in whole minutes, `null` when unknown. */
export type RecipeDto = {
  title: string;
  times: { total: number | null; preparation: number | null; cooking: number | null; resting: number | null };
  ingredients: RecipeIngredientDto[];
  preparation: string[];
};

export type WeekDishDto = { name: string; recipe: RecipeDto | null };

/** One day of the week, its date as `YYYY-MM-DD`. */
export type WeekDayDto = { day: DayDto; date: string; meals: { lunch: WeekDishDto[]; dinner: WeekDishDto[] } };

/** The user's menu of this week: its number, its Monday, today and the seven days, Monday to Sunday. */
export type WeeklyMenuDto = { menuNumber: number; startsOn: string; today: string; days: WeekDayDto[] };
