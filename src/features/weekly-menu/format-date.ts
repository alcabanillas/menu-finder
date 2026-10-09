// UTC on both sides, as in `menu-planner/format-monday.ts`: the date is read as midnight UTC and written in UTC, so the
// server's zone never shifts the day.
const SHORT = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const WITH_WEEKDAY = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const WEEKDAY = new Intl.DateTimeFormat('es-ES', { weekday: 'long', timeZone: 'UTC' });
/** A `YYYY-MM-DD` date as "5 de octubre". */
export function formatShortDate(date: string): string {
  return SHORT.format(toUtc(date));
}

/** A `YYYY-MM-DD` date as "Miércoles 7 de octubre": capitalised, without the comma `Intl` puts after the weekday. */
export function formatDayDate(date: string): string {
  const text = WITH_WEEKDAY.formatToParts(toUtc(date))
    .map(({ type, value }) => (type === 'literal' ? value.replace(',', '') : value))
    .join('');
  return capitalise(text);
}

/** A `YYYY-MM-DD` date as its weekday alone, "Miércoles". */
export function formatWeekday(date: string): string {
  return capitalise(WEEKDAY.format(toUtc(date)));
}

const DAY_NUMBER = new Intl.DateTimeFormat('es-ES', { day: 'numeric', timeZone: 'UTC' });
const MONTH_SHORT = new Intl.DateTimeFormat('es-ES', { month: 'short', timeZone: 'UTC' });

/** Two `YYYY-MM-DD` dates as a week's range: "5 – 11 oct", or "29 sep – 5 oct" across two months. */
export function formatWeekRange(first: string, last: string): string {
  const firstMonth = sameMonth(first, last) ? '' : ` ${monthShort(first)}`;
  return `${DAY_NUMBER.format(toUtc(first))}${firstMonth} – ${DAY_NUMBER.format(toUtc(last))} ${monthShort(last)}`;
}

const YEAR_MONTH_LENGTH = 7;

function sameMonth(first: string, last: string): boolean {
  return first.slice(0, YEAR_MONTH_LENGTH) === last.slice(0, YEAR_MONTH_LENGTH);
}

function monthShort(date: string): string {
  return MONTH_SHORT.format(toUtc(date)).replace('.', '');
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}
