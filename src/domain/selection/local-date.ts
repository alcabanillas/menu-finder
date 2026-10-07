/** A calendar date with no time or zone, as `YYYY-MM-DD`. The rules of the week work on these, never on `Date`. */
export type LocalDate = `${string}-${string}-${string}`;

const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;
// `getUTCDay` counts from Sunday; this shifts it so that Monday is 0.
const MONDAY_OFFSET = 6;
const ISO_DATE_LENGTH = 10;

/** The Monday of the week (Monday to Sunday) that holds `date`. */
export function mondayOf(date: LocalDate): LocalDate {
  return addDays(date, -daysSinceMonday(date));
}

/** `date` moved by `days`, which may be negative. */
export function addDays(date: LocalDate, days: number): LocalDate {
  return toLocalDate(new Date(toUtc(date).getTime() + days * MS_PER_DAY));
}

/** Whether `date` is a Monday. */
export function isMonday(date: LocalDate): boolean {
  return daysSinceMonday(date) === 0;
}

function daysSinceMonday(date: LocalDate): number {
  return (toUtc(date).getUTCDay() + MONDAY_OFFSET) % DAYS_PER_WEEK;
}

// Midnight UTC: no daylight-saving change can move the day.
function toUtc(date: LocalDate): Date {
  return new Date(`${date}T00:00:00Z`);
}

function toLocalDate(instant: Date): LocalDate {
  return instant.toISOString().slice(0, ISO_DATE_LENGTH) as LocalDate;
}
