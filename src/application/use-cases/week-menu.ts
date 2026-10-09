import type { Clock } from '@/application/ports/clock';
import type { MenuRepository } from '@/application/ports/menu-repository';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import { selectedWeek, type WeekFailure } from '@/application/use-cases/selected-week';
import type { MenuWeek } from '@/domain/menu/menu-week';
import type { LocalDate } from '@/domain/selection/local-date';
import type { Selection } from '@/domain/selection/selection';
import { earliestStartsOn } from '@/domain/selection/starts-on';
import { err, ok, type Result } from '@/shared/result';

/** Whose menu is asked for and which week: the user id comes from the session, `startsOn` is already validated. */
export type WeekMenuInput = { userId: string; startsOn: LocalDate };

type Deps = {
  selections: SelectionRepository;
  clock: Clock;
  menus: Pick<MenuRepository, 'find'>;
  recipes: Pick<RecipeRepository, 'findByFiles'>;
};

const FAILED: WeekFailure = { kind: 'failed' };

/** The user's menu for the week that starts on `startsOn`; `null` when that week has no selection. */
export async function weekMenu(deps: Deps, input: WeekMenuInput): Promise<Result<MenuWeek | null, WeekFailure>> {
  const selection = await selectionOn(deps, input);
  if (!selection.ok) return err(FAILED);
  if (!selection.value) return ok(null);

  const week = await selectedWeek(deps, selection.value);
  return week.ok ? ok(week.value) : err(FAILED);
}

async function selectionOn(
  { selections, clock }: Deps,
  { userId, startsOn }: WeekMenuInput,
): Promise<Result<Selection | null, WeekFailure>> {
  const listed = await selections.listFrom(userId, earliestStartsOn(clock.today()));
  if (!listed.ok) return err(FAILED);
  return ok(listed.value.find((selection) => selection.startsOn === startsOn) ?? null);
}
