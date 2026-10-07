import type { LocalDate } from '@/domain/selection/local-date';

/** A user's choice of a menu for the week that starts on `startsOn`, always a Monday. */
export type Selection = { id: string; menuNumber: number; startsOn: LocalDate };

/**
 * The menu of the week that holds today, and the menu whose shopping list is current: next Monday's if chosen,
 * otherwise this week's. Either may be missing.
 */
export type CurrentSelections = { activeMenu: Selection | null; shoppingList: Selection | null };
