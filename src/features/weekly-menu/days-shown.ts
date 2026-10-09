import type { WeekDayDto } from '@/application/dto/weekly-menu';

/** The days the desktop view shows: Monday to Saturday always, Sunday only when the menu has a dish for it. */
export function daysShown(days: WeekDayDto[]): WeekDayDto[] {
  return days.filter(({ day, meals }) => day !== 'sunday' || meals.lunch.length > 0 || meals.dinner.length > 0);
}
