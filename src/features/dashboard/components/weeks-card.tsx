import Link from 'next/link';
import type { WeekToChooseDto, WeeksToChooseDto } from '@/application/dto/weeks-to-choose';
import { ArrowRight } from '@/shared/ui/arrow-right';
import { buttonClasses } from '@/shared/ui/button';
import { formatWeekRange } from '@/shared/format-week';

/** This week and next week as the dashboard shows them, or not readable. */
export type DashboardWeeks = { kind: 'read'; weeks: WeeksToChooseDto } | { kind: 'failed' };

type WeeksCardProps = { weeks: DashboardWeeks };

// After the weeks card of the design system's `ui_kits/app/HomeScreen.jsx` (version 1792319321-0ddf). There is no menu
// subtitle: the data has no menu titles (design D6 of MF-25). With no menu this week the card has a dashed border and is
// drawn only from an 800 px container: on a phone the notice of today already says it.
const HERO = 'rounded-lg bg-surface-hero px-[22px] py-[18px] text-white';
const DASHED =
  'hidden rounded-lg border border-dashed border-border-strong bg-surface-card px-[22px] py-[18px] @min-[800px]:block';
const EYEBROW = 'text-eyebrow font-semibold uppercase tracking-[var(--text-eyebrow--letter-spacing)]';

/** This week's menu and next week's, with the way to choose next week's when it has none. */
export function WeeksCard({ weeks }: WeeksCardProps) {
  if (weeks.kind === 'failed') {
    return (
      <section aria-label="Semanas" className={HERO}>
        <p>No se ha podido cargar tu menú.</p>
      </section>
    );
  }
  const { current, next } = weeks.weeks;
  const onHero = current.menuNumber !== null;
  return (
    <section aria-label="Semanas" className={onHero ? HERO : DASHED}>
      <ThisWeek week={current} />
      <NextWeek week={next} onHero={onHero} />
    </section>
  );
}

function ThisWeek({ week }: { week: WeekToChooseDto }) {
  if (week.menuNumber === null) {
    return (
      <>
        <p className={`${EYEBROW} text-text-muted`}>Esta semana · {rangeOf(week)}</p>
        <p className="mt-1 text-text-muted">Sin menú</p>
      </>
    );
  }
  return (
    <>
      <p className={`${EYEBROW} text-aceite-300`}>Esta semana · {rangeOf(week)}</p>
      <p className="mt-1 text-[28px] font-extrabold leading-[1.1]">Menú {week.menuNumber}</p>
    </>
  );
}

function NextWeek({ week, onHero }: { week: WeekToChooseDto; onHero: boolean }) {
  const chosen = week.menuNumber !== null;
  return (
    <div
      className={`mt-3.5 flex items-center justify-between gap-3 border-t pt-3 ${onHero ? 'border-white/25' : 'border-border-hairline'}`}
    >
      <div className="min-w-0">
        <p className={`${EYEBROW} ${onHero ? 'text-olive-100' : 'text-text-muted'}`}>
          La semana que viene{chosen ? ` · ${rangeOf(week)}` : ''}
        </p>
        <p className={`mt-0.5 font-bold ${onHero ? '' : 'text-text-strong'}`}>
          {chosen ? `Menú ${week.menuNumber}` : 'Sin elegir'}
        </p>
      </div>
      {!chosen && (
        <Link
          href="/planner?week=next"
          className={buttonClasses({ variant: onHero ? 'warm' : 'secondary', size: 'sm', className: 'no-underline' })}
        >
          Elegir
          <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}

function rangeOf({ startsOn, endsOn }: WeekToChooseDto): string {
  return formatWeekRange(startsOn, endsOn);
}
