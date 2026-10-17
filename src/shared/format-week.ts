// UTC on both sides, as in `format-monday.ts`: the date is read as midnight UTC and written in UTC, so the server's
// zone never shifts the day.
const DAY_NUMBER = new Intl.DateTimeFormat('es-ES', { day: 'numeric', timeZone: 'UTC' });
const MONTH_SHORT = new Intl.DateTimeFormat('es-ES', { month: 'short', timeZone: 'UTC' });
const YEAR_MONTH_LENGTH = 7;

/** A `YYYY-MM-DD` date as its day and short month, "12 oct". */
export function formatDayMonth(date: string): string {
  return `${DAY_NUMBER.format(toUtc(date))} ${monthShort(date)}`;
}

/** Two `YYYY-MM-DD` dates as a week's range: "5 – 11 oct", or "29 sept – 5 oct" across two months. */
export function formatWeekRange(first: string, last: string): string {
  const firstMonth = sameMonth(first, last) ? '' : ` ${monthShort(first)}`;
  return `${DAY_NUMBER.format(toUtc(first))}${firstMonth} – ${formatDayMonth(last)}`;
}

function sameMonth(first: string, last: string): boolean {
  return first.slice(0, YEAR_MONTH_LENGTH) === last.slice(0, YEAR_MONTH_LENGTH);
}

function monthShort(date: string): string {
  return MONTH_SHORT.format(toUtc(date)).replace('.', '');
}

function toUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}
