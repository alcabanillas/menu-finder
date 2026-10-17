import type { ReactNode } from 'react';
import { formatDayDate } from '@/shared/format-date';

/** `today` is known only when the week's menu was read; without it the heading has no date. */
type DashboardLayoutProps = { today?: string; menu: ReactNode; shopping: ReactNode; meals?: ReactNode };

// The grid of the design system's `ui_kits/app/HomeScreen.jsx` (version 1792255497-a1ff): one column on a phone; from an
// 800 px container, the menu and the shopping in the first row and today's meals across below. The mock's "Buenos días"
// is the heading "Hoy" with today's date as eyebrow (design D6 of MF-25).
const PAGE = 'mx-auto w-full max-w-[1440px] px-gutter-mobile pt-4 pb-8 @min-[640px]:px-8 @min-[640px]:pt-6 @min-[640px]:pb-14';
const GRID =
  'mt-6 flex flex-col gap-8 @min-[800px]:grid @min-[800px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] ' +
  '@min-[800px]:items-start @min-[800px]:gap-10';

/** The page of a signed-in user's `/`: the heading and the three blocks the page composes. */
export function DashboardLayout({ today, menu, shopping, meals }: DashboardLayoutProps) {
  return (
    <div className={PAGE}>
      {today && (
        <p className="text-eyebrow font-semibold uppercase tracking-[var(--text-eyebrow--letter-spacing)] text-olive-600">
          {formatDayDate(today)}
        </p>
      )}
      <h1 className="mt-1 text-h1 text-text-strong">Hoy</h1>
      <div className={GRID}>
        <div className="min-w-0 @min-[800px]:col-start-1 @min-[800px]:row-start-1">{menu}</div>
        {meals && <div className="min-w-0 @min-[800px]:col-span-full @min-[800px]:row-start-2">{meals}</div>}
        <div className="min-w-0 @min-[800px]:col-start-2 @min-[800px]:row-start-1">{shopping}</div>
      </div>
    </div>
  );
}
