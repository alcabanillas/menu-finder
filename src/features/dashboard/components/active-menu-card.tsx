import Link from 'next/link';
import { buttonClasses } from '@/shared/ui/button';
import { formatWeekRange } from '@/shared/format-week';

/** The menu of this week as the dashboard shows it: chosen, not chosen, or not readable. */
export type ActiveMenu =
  | { kind: 'chosen'; menuNumber: number; firstDate: string; lastDate: string }
  | { kind: 'none' }
  | { kind: 'failed' };

type ActiveMenuCardProps = { menu: ActiveMenu };

// After the olive hero of the design system's `ui_kits/app/HomeScreen.jsx` (version 1792255497-a1ff). There is no menu
// subtitle: the data has no menu titles (design D6 of MF-25).
const CARD = 'rounded-lg bg-surface-hero p-[22px] text-white';
const EYEBROW =
  'text-eyebrow font-semibold uppercase tracking-[var(--text-eyebrow--letter-spacing)] text-aceite-300';
const GHOST_ON_HERO = 'text-white! no-underline hover:bg-white/10';

/** The hero of the dashboard: the menu of this week and where to go from it. */
export function ActiveMenuCard({ menu }: ActiveMenuCardProps) {
  return (
    <section aria-labelledby="menu-activo" className={CARD}>
      <p id="menu-activo" className={EYEBROW}>
        Menú activo
      </p>
      <ActiveMenuBody menu={menu} />
    </section>
  );
}

function ActiveMenuBody({ menu }: ActiveMenuCardProps) {
  if (menu.kind === 'failed') return <p className="mt-2.5">No se ha podido cargar tu menú.</p>;
  if (menu.kind === 'none') {
    return (
      <>
        <p className="mt-2.5">Aún no has elegido menú para esta semana.</p>
        <Link href="/planner" className={buttonClasses({ variant: 'warm', size: 'sm', className: 'mt-[18px] no-underline' })}>
          Elegir menú
        </Link>
      </>
    );
  }
  return (
    <>
      <h2 className="mt-1.5 text-[30px] font-extrabold leading-[1.1]">Menú {menu.menuNumber}</h2>
      <p className="mt-2 text-small text-olive-100">{formatWeekRange(menu.firstDate, menu.lastDate)}</p>
      <div className="mt-[18px] flex gap-2">
        <Link href="/menu" className={buttonClasses({ variant: 'warm', size: 'sm', className: 'no-underline' })}>
          Ver la semana
        </Link>
        <Link href="/planner" className={buttonClasses({ variant: 'ghost', size: 'sm', className: GHOST_ON_HERO })}>
          Cambiar menú
        </Link>
      </div>
    </>
  );
}
