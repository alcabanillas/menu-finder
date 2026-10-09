import type { Clock } from '@/application/ports/clock';
import type { MenuRepository } from '@/application/ports/menu-repository';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import { currentSelections } from '@/application/use-cases/current-selections';
import { selectedWeek } from '@/application/use-cases/selected-week';
import type { MenuWeek } from '@/domain/menu/menu-week';
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

  const week = await selectedWeek(deps, selection);
  return week.ok ? ok(week.value) : err(FAILED);
}
