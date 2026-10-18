import type { LocalDate } from '@/domain/selection/local-date';

/** A user's choice of a menu for the week that starts on `startsOn`, always a Monday. */
export type Selection = { id: string; menuNumber: number; startsOn: LocalDate };

/**
 * The selection of the week that holds today, and the selection the current shopping list comes from: next Monday's
 * if chosen, otherwise this week's. Either may be missing.
 */
export type CurrentSelections = { thisWeekSelection: Selection | null; shoppingSelection: Selection | null };
