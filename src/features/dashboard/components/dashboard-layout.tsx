import type { ReactNode } from 'react';
import type { DayDto } from '@/application/dto/weekly-menu';
import { formatDayDate } from '@/shared/format-date';
import { DAY_BARS } from '@/shared/ui/day-bars';

/** `today` is unknown only when the menu read failed; then the heading has no date. */
type DashboardLayoutProps = { today?: string; weeks: ReactNode; meals: ReactNode; shopping: ReactNode };

// The grid of the design system's `ui_kits/app/HomeScreen.jsx` (version 1792319321-0ddf). On a phone one column in the
// order of the page: weeks, today, shopping. From an 800 px container, today takes the wide column across two rows and
// the weeks and the shopping stack in the narrow one (340 px; 380 px from 1100 px). The second row takes the leftover
// height, so the shopping sits right under the weeks however long today is.
const PAGE = 'mx-auto w-full max-w-[1440px] px-gutter-mobile pt-5 pb-8 @min-[640px]:px-8 @min-[640px]:pt-8 @min-[640px]:pb-14';
const GRID =
  'flex flex-col gap-7 @min-[800px]:grid @min-[800px]:grid-cols-[minmax(0,1fr)_340px] @min-[800px]:grid-rows-[auto_1fr] ' +
  '@min-[800px]:items-start @min-[800px]:gap-x-12 @min-[800px]:gap-y-4 ' +
  '@min-[1100px]:grid-cols-[minmax(0,1fr)_380px] @min-[1100px]:gap-x-14';
const SIDE = 'min-w-0 @min-[800px]:col-start-2';
const EYEBROW =
  'flex items-center gap-2.5 text-eyebrow font-semibold uppercase tracking-[var(--text-eyebrow--letter-spacing)] text-olive-600';
// Sunday is 0 in `getUTCDay`. The bars are the shared ones, so Sunday's white one has its border.
const DAYS: DayDto[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** The page of a signed-in user's `/`: what is on today first, and the weeks and the shopping beside it. */
export function DashboardLayout({ today, weeks, meals, shopping }: DashboardLayoutProps) {
  return (
    <div className={PAGE}>
      <div className={GRID}>
        <div className={`${SIDE} @min-[800px]:row-start-1`}>{weeks}</div>
        <section
          aria-labelledby="que-toca-hoy"
          className="min-w-0 @min-[800px]:col-start-1 @min-[800px]:row-span-2 @min-[800px]:row-start-1"
        >
          {today && <TodayDate date={today} />}
          <h1 id="que-toca-hoy" className="mt-1 text-[30px] font-extrabold leading-[1.1] tracking-[-0.02em] text-text-strong @min-[800px]:text-h1">
            Qué toca hoy
          </h1>
          {meals}
        </section>
        <div className={`${SIDE} @min-[800px]:row-start-2`}>{shopping}</div>
      </div>
    </div>
  );
}

function TodayDate({ date }: { date: string }) {
  return (
    <p className={EYEBROW}>
      <span aria-hidden="true" className={`h-[5px] w-6 flex-none rounded-[3px] ${dayColourOf(date)}`} />
      {formatDayDate(date)}
    </p>
  );
}

function dayColourOf(date: string): string {
  return DAY_BARS[DAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]];
}
