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

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}
