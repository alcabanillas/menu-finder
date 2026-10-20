import Link from 'next/link';
import { formatDayMonth } from '@/shared/format-week';
import { ArrowRight } from '@/shared/ui/arrow-right';
import { buttonClasses } from '@/shared/ui/button';

/**
 * Why a week has no menu: it is past, it can still take one, next week's menu already closes it, or it is next week.
 * `locked` and `future` carry the Monday their link or label needs, as `YYYY-MM-DD`.
 */
export type EmptyWeek =
  | { kind: 'past' }
  | { kind: 'open' }
  | { kind: 'locked'; nextMenuNumber: number; nextStartsOn: string }
  | { kind: 'future'; startsOn: string };

type NoMenuNoticeProps = {
  week: EmptyWeek;
  /** Olive or grey; by default grey where the week cannot take a menu. Hoy keeps olive for both of its cases. */
  tone?: 'olive' | 'grey';
  className?: string;
};

// After the notice of the design system's `ui_kits/app/MenuScreen.jsx` (`MenuEmpty`, version 1792450792-6aa6) and
// `HomeScreen.jsx`: one piece for Hoy and for `/menu`. Olive when the week can take a menu, grey when it cannot. Locked
// or not comes from `isLocked`, the same rule as Buscar (design D2 of MF-25 and D2 of MF-74). Margin and width are the page's.
const NOTICE = 'flex flex-col items-start gap-3.5 rounded-lg border p-6';
const OLIVE = 'border-olive-100 bg-olive-50';
const GREY = 'border-border-hairline bg-surface-hover';
const CHOOSE_TEXT = 'Elige uno en Buscar: escribe lo que os apetece y verás los menús que encajan.';

/** What the user can do with a week that has no menu. */
export function NoMenuNotice({ week, tone, className }: NoMenuNoticeProps) {
  const grey = tone ? tone === 'grey' : week.kind === 'past' || week.kind === 'locked';
  return (
    <div role="status" className={[NOTICE, grey ? GREY : OLIVE, className].filter(Boolean).join(' ')}>
      <Case week={week} />
    </div>
  );
}

function Case({ week }: { week: EmptyWeek }) {
  switch (week.kind) {
    case 'past':
      return <NoticeText title="No se eligió menú para esta semana" text="Las semanas pasadas no se pueden cambiar." />;
    case 'open':
      return <ChooseWeek title="Esta semana aún no tiene menú" label="Elegir menú para esta semana" week="current" />;
    case 'locked':
      return <LockedWeek {...week} />;
    case 'future':
      return (
        <ChooseWeek
          title="La semana que viene aún no tiene menú"
          label={`Elegir menú para el ${formatDayMonth(week.startsOn)}`}
          week="next"
        />
      );
  }
}

function ChooseWeek({ title, label, week }: { title: string; label: string; week: 'current' | 'next' }) {
  return (
    <>
      <NoticeText title={title} text={CHOOSE_TEXT} />
      <Link href={`/planner?week=${week}`} className={buttonClasses({ className: 'no-underline' })}>
        {label}
        <ArrowRight />
      </Link>
    </>
  );
}

function LockedWeek({ nextMenuNumber, nextStartsOn }: { nextMenuNumber: number; nextStartsOn: string }) {
  return (
    <>
      <NoticeText
        title="Esta semana no tiene menú"
        text={`Ya está elegido el de la semana que viene (Menú ${nextMenuNumber}) y la lista de la compra ya es la de esa semana, así que esta ya no se cambia.`}
      />
      <Link
        href={`/menu?startsOn=${nextStartsOn}`}
        className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'no-underline' })}
      >
        Ver el menú de la semana que viene
        <ArrowRight size={16} />
      </Link>
    </>
  );
}

function NoticeText({ title, text }: { title: string; text: string }) {
  return (
    <>
      <p className="text-[22px] font-extrabold leading-[1.2] tracking-[-0.02em] text-text-strong">{title}</p>
      <p className="max-w-[52ch] text-[15px] leading-normal text-text-body">{text}</p>
    </>
  );
}
