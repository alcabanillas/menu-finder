import type { WeekDayDto } from '@/application/dto/weekly-menu';

/**
 * What the dashboard shows after today: tomorrow's dishes in the same week, next week's Monday when today is a
 * Sunday (with its menu number and date), that next week has no menu, or nothing (no dishes, or the read failed).
 */
export type TomorrowDto =
  | { kind: 'day'; day: WeekDayDto }
  | { kind: 'next-week'; day: WeekDayDto; menuNumber: number; startsOn: string }
  | { kind: 'no-menu'; startsOn: string }
  | { kind: 'none' };

/** What is on today and tomorrow; `day` is `null` when this week has no menu. */
export type TodaysMenuDto = { today: string; day: WeekDayDto | null; tomorrow: TomorrowDto };
