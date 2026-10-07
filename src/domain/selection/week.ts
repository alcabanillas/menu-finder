import { addDays, mondayOf, type LocalDate } from '@/domain/selection/local-date';
import type { CurrentSelections, Selection } from '@/domain/selection/selection';

const DAYS_PER_WEEK = 7;

/** The Monday a new choice starts on: this week's if the user has no menu on it, otherwise next week's. */
export function startsOnFor(today: LocalDate, selectionsFromThisMonday: Selection[]): LocalDate {
  const thisMonday = mondayOf(today);
  return startingOn(selectionsFromThisMonday, thisMonday) ? nextMonday(today) : thisMonday;
}

/** The active menu (this week's) and the shopping list (next week's if chosen, otherwise this week's). */
export function currentOf(selectionsFromThisMonday: Selection[], today: LocalDate): CurrentSelections {
  const activeMenu = startingOn(selectionsFromThisMonday, mondayOf(today));
  const shoppingList = startingOn(selectionsFromThisMonday, nextMonday(today)) ?? activeMenu;
  return { activeMenu, shoppingList };
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
