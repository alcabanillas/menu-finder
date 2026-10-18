import Link from 'next/link';
import { ArrowRight } from '@/shared/ui/arrow-right';
import { buttonClasses } from '@/shared/ui/button';

/** Why this week has no menu: it can still take one, or next week's menu already locks it. */
export type EmptyWeek = { kind: 'open' } | { kind: 'locked'; nextMenuNumber: number; nextStartsOn: string };

type NoMenuNoticeProps = { week: EmptyWeek };

// After the notice of the design system's `ui_kits/app/HomeScreen.jsx` (version 1792319321-0ddf), in place of today's
// dishes when this week has no menu. Locked or not comes from `weeksToChoose`, the same rule as Buscar (design D2 of MF-25).
const NOTICE =
  'mt-5 flex flex-col items-start gap-3.5 rounded-lg border border-olive-100 bg-olive-50 p-6';

/** What the user can do this week without a menu. */
export function NoMenuNotice({ week }: NoMenuNoticeProps) {
  return (
    <div role="status" className={NOTICE}>
      {week.kind === 'open' ? <OpenWeek /> : <LockedWeek {...week} />}
    </div>
  );
}

function OpenWeek() {
  return (
    <>
      <NoticeText
        title="Esta semana aún no tiene menú"
        text="Elige uno en Buscar: escribe lo que os apetece y verás los menús que encajan."
      />
      <Link href="/planner?week=current" className={buttonClasses({ className: 'no-underline' })}>
        Elegir menú para esta semana
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
