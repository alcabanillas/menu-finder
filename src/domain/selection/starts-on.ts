import { addDays, isMonday, mondayOf, type LocalDate } from '@/domain/selection/local-date';

const WEEKS_BACK = 10;
const WEEKS_AHEAD = 1;
const DAYS_PER_WEEK = 7;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_LENGTH = 10;

/** The oldest Monday a selection may start on and still be read: ten weeks before this Monday. */
export function earliestStartsOn(today: LocalDate): LocalDate {
  return earliest(mondayOf(today));
}

/** The weeks the header may step to from `shown`; `null` where the window ends. */
export function neighbouringWeeks(
  shown: LocalDate,
  today: LocalDate,
): { previous: LocalDate | null; next: LocalDate | null } {
  const thisMonday = mondayOf(today);
  const previous = addDays(shown, -DAYS_PER_WEEK);
  const next = addDays(shown, DAYS_PER_WEEK);
  return {
    previous: previous >= earliest(thisMonday) ? previous : null,
    next: next <= latest(thisMonday) ? next : null,
  };
}

/**
 * The Monday the page shows for a `startsOn` query value: the value when it is a real Monday within ten weeks back
 * and one week ahead of `today`, otherwise this week's Monday. Anything else is ignored, never reported.
 */
export function resolveStartsOn(raw: unknown, today: LocalDate): LocalDate {
  const thisMonday = mondayOf(today);
  return isInWindow(raw, thisMonday) ? raw : thisMonday;
}

function isInWindow(raw: unknown, thisMonday: LocalDate): raw is LocalDate {
  return isWellFormed(raw) && isMonday(raw) && raw >= earliest(thisMonday) && raw <= latest(thisMonday);
}

// Length and shape are checked before any date code runs.
function isWellFormed(raw: unknown): raw is LocalDate {
  return typeof raw === 'string' && raw.length === ISO_DATE_LENGTH && ISO_DATE_PATTERN.test(raw) && isRealDate(raw);
}

// Formatting the parsed date back must give the same text: `2026-02-30` would otherwise roll over to March.
// An impossible month parses to an invalid date, which has no text form, so it is refused first.
function isRealDate(raw: string): boolean {
  const parsed = new Date(`${raw}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, ISO_DATE_LENGTH) === raw;
}

function earliest(thisMonday: LocalDate): LocalDate {
  return addDays(thisMonday, -WEEKS_BACK * DAYS_PER_WEEK);
}

function latest(thisMonday: LocalDate): LocalDate {
  return addDays(thisMonday, WEEKS_AHEAD * DAYS_PER_WEEK);
}
