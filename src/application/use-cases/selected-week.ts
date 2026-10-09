import type { Clock } from '@/application/ports/clock';
import type { MenuRepository } from '@/application/ports/menu-repository';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import { menuWeek, type MenuWeek } from '@/domain/menu/menu-week';
import type { WeeklyMenu } from '@/domain/menu/weekly-menu';
import type { Selection } from '@/domain/selection/selection';
import { err, ok, type Result } from '@/shared/result';

/** The menu could not be read: a fault of the system. */
export type WeekFailure = { kind: 'failed' };

export type SelectedWeekDeps = {
  clock: Clock;
  menus: Pick<MenuRepository, 'find'>;
  recipes: Pick<RecipeRepository, 'findByFiles'>;
};

const FAILED: WeekFailure = { kind: 'failed' };

/** The week a selection chose, laid on its dates with the recipes of its dishes. */
export async function selectedWeek(
  deps: SelectedWeekDeps,
  selection: Selection,
): Promise<Result<MenuWeek, WeekFailure>> {
  const menu = await deps.menus.find(selection.menuNumber);
  // The selection's menu is always stored (foreign key); a missing one is a fault, not "no menu".
  if (!menu.ok || !menu.value) return err(FAILED);
  const recipes = await deps.recipes.findByFiles(recipeFilesOf(menu.value));
  if (!recipes.ok) return err(FAILED);
  return ok(menuWeek(menu.value, recipes.value, selection.startsOn, deps.clock.today()));
}

function recipeFilesOf({ meals }: WeeklyMenu): string[] {
  const files = meals.flatMap(({ dishes }) => dishes.map(({ recipeFile }) => recipeFile));
  return [...new Set(files.filter((file) => file !== null))];
}
