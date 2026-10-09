import Link from 'next/link';
import type { WeekNavigationDto } from '@/application/dto/week-navigation';
import { formatWeekRange } from '@/features/weekly-menu/format-date';

// After the design system's `MenuScreen.jsx` (`.mf-seg`, `.mf-mh__nav`): a pill with two chevrons around the range.
const FIRST_DAY = 0;
const LAST_DAY = 6;
// The chevrons are 44 px, the minimum touch target; the pill grows around them.
const SEGMENT = 'inline-flex items-center rounded-pill border border-border-strong bg-surface-page';
const CHEVRON =
  'inline-flex size-11 items-center justify-center rounded-pill text-ink hover:bg-gray-100 ' +
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink';
const CHEVRON_OFF = 'inline-flex size-11 items-center justify-center text-ink opacity-30';
const RANGE = 'min-w-28 px-1 text-center text-sm font-semibold tabular-nums whitespace-nowrap text-ink';
const THIS_WEEK =
  'inline-flex h-10 items-center rounded-pill px-4 text-sm font-semibold text-olive-600 hover:bg-olive-50 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

/** The previous and next week controls of `/menu`, the range they show, and a way back to this week. */
export function WeekNav({ shown, current, previous, next, days }: WeekNavigationDto) {
  return (
    <div className="flex items-center gap-3">
      <nav aria-label="Cambiar de semana" className={SEGMENT}>
        <Step to={previous} label="Semana anterior" direction="previous" />
        <span className={RANGE}>{formatWeekRange(days[FIRST_DAY], days[LAST_DAY])}</span>
        <Step to={next} label="Semana siguiente" direction="next" />
      </nav>
      {shown !== current ? (
        <Link href="/menu" className={THIS_WEEK}>
          Esta semana
        </Link>
      ) : null}
    </div>
  );
}

function Step({ to, label, direction }: { to: string | null; label: string; direction: 'previous' | 'next' }) {
  if (to === null)
    return (
      <span aria-disabled="true" className={CHEVRON_OFF}>
        <Chevron direction={direction} />
        <span className="sr-only">{label}</span>
      </span>
    );
  return (
    <Link href={`/menu?startsOn=${to}`} className={CHEVRON}>
      <Chevron direction={direction} />
      <span className="sr-only">{label}</span>
    </Link>
  );
}

function Chevron({ direction }: { direction: 'previous' | 'next' }) {
  const points = direction === 'previous' ? '15 6 9 12 15 18' : '9 6 15 12 9 18';
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points={points} />
    </svg>
  );
}
