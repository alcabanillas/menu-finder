// UTC on both sides: the date is read as midnight UTC and written in UTC, so the server's zone never shifts the day.
const FORMAT = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

/** A `YYYY-MM-DD` date as "lunes 5 de octubre": the Spanish long date without the comma `Intl` puts after the day. */
export function formatMonday(date: string): string {
  return FORMAT.formatToParts(new Date(`${date}T00:00:00Z`))
    .map(({ type, value }) =>
      type === 'literal' ? value.replace(',', '') : value,
    )
    .join('');
}
