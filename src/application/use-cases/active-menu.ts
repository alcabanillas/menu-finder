import type { Clock } from '@/application/ports/clock';
import type { MenuRepository } from '@/application/ports/menu-repository';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import { currentSelections } from '@/application/use-cases/current-selections';
import { menuWeek, type MenuWeek } from '@/domain/menu/menu-week';
import type { WeeklyMenu } from '@/domain/menu/weekly-menu';
import { err, ok, type Result } from '@/shared/result';

/** Whose menu is asked for: the user id comes from the session. */
export type ActiveMenuInput = { userId: string };

/** The menu could not be read: a fault of the system. */
export type ActiveMenuFailure = { kind: 'failed' };

type Deps = {
  selections: SelectionRepository;
  clock: Clock;
  menus: Pick<MenuRepository, 'find'>;
  recipes: Pick<RecipeRepository, 'findByFiles'>;
};

const FAILED: ActiveMenuFailure = { kind: 'failed' };

/** The user's menu of this week laid on its dates, with the recipes of its dishes; `null` when there is none. */
export async function activeMenu(
  deps: Deps,
  input: ActiveMenuInput,
): Promise<Result<MenuWeek | null, ActiveMenuFailure>> {
  const selections = await currentSelections(deps, input);
  if (!selections.ok) return err(FAILED);
  const { activeMenu: selection } = selections.value;
  if (!selection) return ok(null);

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
