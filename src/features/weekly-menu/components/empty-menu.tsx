import Link from 'next/link';
import type { ReactNode } from 'react';
import type { WeekStatusDto } from '@/application/dto/week-navigation';
import { WeekHeader } from '@/features/weekly-menu/components/week-header';
import { formatShortDate, formatWeekday } from '@/features/weekly-menu/format-date';

// After the design system's `MenuScreen.jsx` (`.mf-empty`, `.mf-ghost`): a grey card with the next step, and the seven
// days of the week as dashed placeholders below it.
const CARD =
  'flex flex-col gap-4 rounded-[12px] bg-surface-hover p-5 @min-[640px]:flex-row @min-[640px]:items-center ' +
  '@min-[640px]:justify-between @min-[640px]:p-6';
const CARD_TITLE = 'text-base font-semibold leading-snug text-ink';
const CARD_TEXT = 'mt-1 text-sm leading-normal text-text-muted';
const BUTTON =
  'inline-flex h-10 items-center rounded-pill border border-border-strong bg-surface-page px-4 text-sm font-semibold ' +
  'text-ink hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
const GHOSTS =
  'grid grid-cols-1 gap-2 px-gutter-mobile pb-8 pt-4 @min-[640px]:px-8 @min-[800px]:grid-cols-2 @min-[800px]:gap-4 ' +
  '@min-[1100px]:grid-cols-3';
const GHOST = 'flex flex-col gap-1 rounded-[12px] border border-dashed border-border-strong px-4 py-3 text-text-muted';

type EmptyMenuProps = {
  /** `failed`: the week could not be read. Otherwise where the week sits in the window. */
  status: WeekStatusDto | 'failed';
  /** The seven dates of the week, Monday to Sunday; none when the week could not be read. */
  days?: string[];
  nav?: ReactNode;
};

/** `/menu` for a week with no menu, or one that could not be read. */
export function EmptyMenu({ status, days, nav }: EmptyMenuProps) {
  if (status === 'failed') return <FailedMenu />;
  return (
    <>
      <WeekHeader
        eyebrow={days ? `Semana del ${formatShortDate(days[0])}` : undefined}
        title="Menú"
        nav={nav}
      />
      <div className="px-gutter-mobile @min-[640px]:px-8">
        <NextStep status={status} />
      </div>
      {days ? <GhostDays days={days} /> : null}
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

function NextStep({ status }: { status: WeekStatusDto }) {
  const past = status === 'past';
  return (
    <div className={CARD}>
      <div>
        <p className={CARD_TITLE}>
          {past ? 'No se eligió menú para esta semana.' : 'Todavía no has elegido menú para esta semana.'}
        </p>
        <p className={CARD_TEXT}>
          {past ? 'Las semanas pasadas no se pueden cambiar.' : 'Elige uno en Buscar, entre los 36 menús del archivo.'}
        </p>
      </div>
      {past ? null : (
        <Link href="/planner" className={BUTTON}>
          Elegir menú
        </Link>
      )}
    </div>
  );
}

function GhostDays({ days }: { days: string[] }) {
  return (
    <div className={GHOSTS} aria-hidden="true">
      {days.map((date) => (
        <div key={date} className={GHOST}>
          <b className="font-extrabold text-[17px] text-ink">{formatWeekday(date)}</b>
          <span className="text-[13px]">{formatShortDate(date)}</span>
        </div>
      ))}
    </div>
  );
}
