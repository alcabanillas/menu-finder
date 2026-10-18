import type { WeekNavigationDto, WeekStatusDto } from '@/application/dto/week-navigation';
import type { Clock } from '@/application/ports/clock';
import type { MenuRepository } from '@/application/ports/menu-repository';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import { menuWeek, type MenuWeek } from '@/domain/menu/menu-week';
import type { WeeklyMenu } from '@/domain/menu/weekly-menu';
import { mondayOf, type LocalDate } from '@/domain/selection/local-date';
import type { Selection } from '@/domain/selection/selection';
import { earliestStartsOn, neighbouringWeeks, resolveStartsOn } from '@/domain/selection/starts-on';
import { weekDates } from '@/domain/selection/week';
import { err, ok, type Result } from '@/shared/result';

/** Whose week is asked for; `startsOn` is the raw query value and is validated here, never trusted. */
export type MenuWeekPageInput = { userId: string; startsOn: unknown };

/** The week on show, its menu if any, and today's date (the dashboard's heading shows it also with no menu). */
export type MenuWeekPage = { navigation: WeekNavigationDto; menu: MenuWeek | null; today: LocalDate };

/** The menu could not be read: a fault of the system. */
export type WeekFailure = { kind: 'failed' };

/** Whose menu is asked for and which week: the user id comes from the session, `startsOn` is already validated. */
type WeekMenuInput = { userId: string; startsOn: LocalDate };

type Deps = {
  selections: SelectionRepository;
  clock: Clock;
  menus: Pick<MenuRepository, 'find'>;
  recipes: Pick<RecipeRepository, 'findByFiles'>;
};

const FAILED: WeekFailure = { kind: 'failed' };

/** The week `/menu` shows: the validated `startsOn` (or this week), its menu if any, and the header's neighbours. */
export async function menuWeekPage(deps: Deps, input: MenuWeekPageInput): Promise<Result<MenuWeekPage, WeekFailure>> {
  const today = deps.clock.today();
  const shown = resolveStartsOn(input.startsOn, today);
  const menu = await weekMenu(deps, { userId: input.userId, startsOn: shown });
  if (!menu.ok) return err(FAILED);
  return ok({ navigation: navigationOf(shown, today), menu: menu.value, today });
}

/** The user's menu for the week that starts on `startsOn`; `null` when that week has no selection. */
async function weekMenu(deps: Deps, input: WeekMenuInput): Promise<Result<MenuWeek | null, WeekFailure>> {
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

/** The week a selection chose, laid on its dates with the recipes of its dishes. */
async function selectedWeek(deps: Deps, selection: Selection): Promise<Result<MenuWeek, WeekFailure>> {
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

function navigationOf(shown: LocalDate, today: LocalDate): WeekNavigationDto {
  const current = mondayOf(today);
  return {
    shown,
    current,
    ...neighbouringWeeks(shown, today),
    status: statusOf(shown, current),
    days: weekDates(shown),
  };
}

function statusOf(shown: LocalDate, current: LocalDate): WeekStatusDto {
  if (shown === current) return 'current';
  return shown < current ? 'past' : 'future';
}
