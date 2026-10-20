import type { LockedByDto, WeekNavigationDto, WeekStatusDto } from '@/application/dto/week-navigation';
import type { Clock } from '@/application/ports/clock';
import type { MenuRepository } from '@/application/ports/menu-repository';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import { menuWeek, type MenuWeek } from '@/domain/menu/menu-week';
import type { WeeklyMenu } from '@/domain/menu/weekly-menu';
import { mondayOf, type LocalDate } from '@/domain/selection/local-date';
import type { Selection } from '@/domain/selection/selection';
import { earliestStartsOn, neighbouringWeeks, resolveStartsOn } from '@/domain/selection/starts-on';
import { isLocked, mondayOfWeek, weekDates } from '@/domain/selection/week';
import { err, ok, type Result } from '@/shared/result';

/** Whose week is asked for; `startsOn` is the raw query value and is validated here, never trusted. */
export type MenuWeekPageInput = { userId: string; startsOn: unknown };

/**
 * The week on show, its menu if any, whether next week's menu closes it (only this week, and only with no menu of its
 * own), and today's date (the dashboard's heading shows it also with no menu).
 */
export type MenuWeekPage = {
  navigation: WeekNavigationDto;
  menu: MenuWeek | null;
  lockedBy: LockedByDto | null;
  today: LocalDate;
};

/** The menu could not be read: a fault of the system. */
export type WeekFailure = { kind: 'failed' };

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
  const listed = await deps.selections.listFrom(input.userId, earliestStartsOn(today));
  if (!listed.ok) return err(FAILED);

  const menu = await weekMenu(deps, selectionOn(listed.value, shown));
  if (!menu.ok) return err(FAILED);
  const lockedBy = menu.value ? null : lockedByOf(listed.value, shown, today);
  return ok({ navigation: navigationOf(shown, today), menu: menu.value, lockedBy, today });
}

function selectionOn(selections: Selection[], startsOn: LocalDate): Selection | null {
  return selections.find((selection) => selection.startsOn === startsOn) ?? null;
}

/** The user's menu for a week, given the selection that starts on it; `null` when that week has none. */
async function weekMenu(deps: Deps, selection: Selection | null): Promise<Result<MenuWeek | null, WeekFailure>> {
  if (!selection) return ok(null);

  const week = await selectedWeek(deps, selection);
  return week.ok ? ok(week.value) : err(FAILED);
}

/** The rule of Buscar: this week is closed once next week has a menu. Only this week can be closed. */
function lockedByOf(selections: Selection[], shown: LocalDate, today: LocalDate): LockedByDto | null {
  if (shown !== mondayOf(today) || !isLocked('current', selections, today)) return null;
  const startsOn = mondayOfWeek(today, 'next');
  // `isLocked` holds only when next week has a selection, so one of them is always found.
  const { menuNumber } = selections.find((selection) => selection.startsOn === startsOn) as Selection;
  return { menuNumber, startsOn };
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
