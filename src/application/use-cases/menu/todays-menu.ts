import type { TodaysMenuDto, TomorrowDto } from '@/application/dto/todays-menu';
import type { WeekDayDto } from '@/application/dto/weekly-menu';
import type { Clock } from '@/application/ports/clock';
import type { MenuRepository } from '@/application/ports/menu-repository';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import { selectedWeek } from '@/application/services/menu/selected-week';
import type { MenuWeek } from '@/domain/menu/menu-week';
import { addDays, mondayOf, type LocalDate } from '@/domain/selection/local-date';
import type { Selection } from '@/domain/selection/selection';
import { err, ok, type Result } from '@/shared/result';

/** Whose day is asked for: the user comes from the session, never from the request. */
export type TodaysMenuInput = { userId: string };

/** Today's menu could not be read: a fault of the system. */
export type TodaysMenuFailure = { kind: 'failed' };

type Deps = {
  selections: SelectionRepository;
  clock: Clock;
  menus: Pick<MenuRepository, 'find'>;
  recipes: Pick<RecipeRepository, 'findByFiles'>;
};

const FAILED: TodaysMenuFailure = { kind: 'failed' };
const NONE: TomorrowDto = { kind: 'none' };

/**
 * What the dashboard shows for today and tomorrow. Tomorrow is the next day of the same week, or, on a Sunday, next
 * week's Monday from the user's menu for next week.
 */
export async function todaysMenu(deps: Deps, input: TodaysMenuInput): Promise<Result<TodaysMenuDto, TodaysMenuFailure>> {
  const today = deps.clock.today();
  const listed = await deps.selections.listFrom(input.userId, mondayOf(today));
  if (!listed.ok) return err(FAILED);

  const selection = selectionOn(listed.value, mondayOf(today));
  if (!selection) return ok({ today, day: null, tomorrow: NONE });
  const week = await selectedWeek(deps, selection);
  if (!week.ok) return err(FAILED);

  const tomorrow = await tomorrowOf(deps, listed.value, week.value, addDays(today, 1));
  return ok({ today, day: dayOn(week.value, today), tomorrow });
}

function selectionOn(selections: Selection[], startsOn: LocalDate): Selection | null {
  return selections.find((selection) => selection.startsOn === startsOn) ?? null;
}

function dayOn(week: MenuWeek, date: LocalDate): WeekDayDto | null {
  return week.days.find((day) => day.date === date) ?? null;
}

function hasDishes({ meals }: WeekDayDto): boolean {
  return meals.lunch.length > 0 || meals.dinner.length > 0;
}

async function tomorrowOf(deps: Deps, selections: Selection[], week: MenuWeek, date: LocalDate): Promise<TomorrowDto> {
  const day = dayOn(week, date);
  if (day) return hasDishes(day) ? { kind: 'day', day } : NONE;
  return nextWeekMonday(deps, selectionOn(selections, date), date);
}

/** Today is a Sunday: tomorrow is next week's Monday, which is `date`. */
async function nextWeekMonday(deps: Deps, selection: Selection | null, date: LocalDate): Promise<TomorrowDto> {
  if (!selection) return { kind: 'no-menu', startsOn: date };
  const week = await selectedWeek(deps, selection);
  const monday = week.ok ? dayOn(week.value, date) : null;
  if (!monday || !hasDishes(monday)) return NONE;
  return { kind: 'next-week', day: monday, menuNumber: selection.menuNumber, startsOn: date };
}
