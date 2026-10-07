import type { Day, MealType, MenuDish, WeeklyMenu } from '@/domain/menu/weekly-menu';
import type { Recipe, RecipeContent } from '@/domain/recipe/recipe';
import type { LocalDate } from '@/domain/selection/local-date';
import { weekDates } from '@/domain/selection/week';

/** A dish as the menu screen shows it: its name and, when it has one, its recipe. */
type WeekDish = { name: string; recipe: RecipeContent | null };

type WeekDay = { day: Day; date: LocalDate; meals: Record<MealType, WeekDish[]> };

/** A menu laid on the dates of the week it was chosen for, Monday to Sunday. */
export type MenuWeek = { menuNumber: number; startsOn: LocalDate; today: LocalDate; days: WeekDay[] };

const DAYS: Day[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/** Lays `menu` on the week that starts on `startsOn`, each dish with its recipe when it is among `recipes`. */
export function menuWeek(menu: WeeklyMenu, recipes: Recipe[], startsOn: LocalDate, today: LocalDate): MenuWeek {
  const byFile = new Map(recipes.map((recipe) => [recipe.file, recipe]));
  const dates = weekDates(startsOn);
  const days = DAYS.map((day, index) => ({
    day,
    date: dates[index],
    meals: { lunch: dishesOf(menu, day, 'lunch', byFile), dinner: dishesOf(menu, day, 'dinner', byFile) },
  }));
  return { menuNumber: menu.number, startsOn, today, days };
}

function dishesOf(menu: WeeklyMenu, day: Day, type: MealType, byFile: Map<string, Recipe>): WeekDish[] {
  const meal = menu.meals.find((candidate) => candidate.day === day && candidate.type === type);
  return (meal?.dishes ?? []).map((dish) => ({ name: dish.name, recipe: recipeOf(dish, byFile) }));
}

// Only the content: the file and the menu it came from are not shown.
function recipeOf({ recipeFile }: MenuDish, byFile: Map<string, Recipe>): RecipeContent | null {
  const recipe = recipeFile === null ? undefined : byFile.get(recipeFile);
  if (!recipe) return null;
  const { title, times, ingredients, preparation } = recipe;
  return { title, times, ingredients, preparation };
}
