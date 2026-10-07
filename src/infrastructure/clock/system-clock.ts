import type { Clock } from '@/application/ports/clock';
import type { LocalDate } from '@/domain/selection/local-date';

/** Where the users live: "today" is the calendar date here, not where the server runs (Vercel runs in UTC). */
const USERS_TIME_ZONE = 'Europe/Madrid';

// The `en-CA` locale writes dates as `YYYY-MM-DD`, the format of `LocalDate`.
const ISO_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: USERS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's date in Europe/Madrid from the system clock, or from the instant its tests give it. */
export class SystemClock implements Clock {
  constructor(private readonly now: () => Date = () => new Date()) {}

  /** The calendar date in Europe/Madrid at this instant, as `YYYY-MM-DD`. */
  today(): LocalDate {
    return ISO_DATE_FORMAT.format(this.now()) as LocalDate;
  }
}
