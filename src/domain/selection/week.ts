import { addDays, mondayOf, type LocalDate } from '@/domain/selection/local-date';
import type { CurrentSelections, Selection } from '@/domain/selection/selection';

const DAYS_PER_WEEK = 7;

/** The week a user chooses a menu for: the one that holds today, or the next one. */
export type Week = 'current' | 'next';

/** The Monday a choice for `week` starts on. */
export function mondayOfWeek(today: LocalDate, week: Week): LocalDate {
  return week === 'current' ? mondayOf(today) : nextMonday(today);
}

/** This week cannot take a choice once next week has a menu: the current shopping list would change under the user. */
export function isLocked(week: Week, selectionsFromThisMonday: Selection[], today: LocalDate): boolean {
  return week === 'current' && startingOn(selectionsFromThisMonday, nextMonday(today)) !== null;
}

/** This week when it is empty and not locked, otherwise next week. */
export function suggestedWeek(selectionsFromThisMonday: Selection[], today: LocalDate): Week {
  const thisWeekIsFree =
    !isLocked('current', selectionsFromThisMonday, today) &&
    startingOn(selectionsFromThisMonday, mondayOf(today)) === null;
  return thisWeekIsFree ? 'current' : 'next';
}

/** The active menu (this week's) and the shopping list (next week's if chosen, otherwise this week's). */
export function currentOf(selectionsFromThisMonday: Selection[], today: LocalDate): CurrentSelections {
  const activeMenu = startingOn(selectionsFromThisMonday, mondayOf(today));
  const shoppingSelection = startingOn(selectionsFromThisMonday, nextMonday(today)) ?? activeMenu;
  return { activeMenu, shoppingSelection };
}

/** The seven dates of the week that starts on `monday`, Monday to Sunday. */
export function weekDates(monday: LocalDate): LocalDate[] {
  return Array.from({ length: DAYS_PER_WEEK }, (_, offset) => addDays(monday, offset));
}

function startingOn(selections: Selection[], monday: LocalDate): Selection | null {
  return selections.find((selection) => selection.startsOn === monday) ?? null;
}

function nextMonday(today: LocalDate): LocalDate {
  return addDays(mondayOf(today), DAYS_PER_WEEK);
}
