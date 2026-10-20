import type { ReactNode } from 'react';
import { WeekHeader } from '@/features/weekly-menu/components/week-header';
import { formatShortDate } from '@/shared/format-date';
import { NoMenuNotice, type EmptyWeek } from '@/shared/ui/no-menu-notice';

// After the design system's `MenuScreen.jsx` (`MenuEmpty`, version 1792450792-6aa6): a week without a menu is the title
// and one notice, the same piece as Hoy's, with no day placeholders. The notice is at most 760 px wide from 800 px.
const NOTICE_BOX = 'px-gutter-mobile pt-3 pb-8 @min-[640px]:px-8 @min-[640px]:pb-10';
const NOTICE_WIDTH = '@min-[800px]:max-w-[760px]';

type EmptyMenuProps = {
  /** `failed`: the week could not be read. Otherwise why the week has no menu. */
  week: EmptyWeek | 'failed';
  /** The seven dates of the week, Monday to Sunday; none when the week could not be read. */
  days?: string[];
  nav?: ReactNode;
};

/** `/menu` for a week with no menu, or one that could not be read. */
export function EmptyMenu({ week, days, nav }: EmptyMenuProps) {
  if (week === 'failed') return <FailedMenu />;
  return (
    <>
      <WeekHeader
        eyebrow={days ? `Semana del ${formatShortDate(days[0])}` : undefined}
        title="Semana sin menú"
        nav={nav}
      />
      <div className={NOTICE_BOX}>
        <NoMenuNotice week={week} className={NOTICE_WIDTH} />
      </div>
    </>
  );
}

function FailedMenu() {
  return (
    <>
      <WeekHeader title="Menú" />
      <p className="px-gutter-mobile py-4 text-text-muted">No se ha podido cargar tu menú.</p>
    </>
  );
}
