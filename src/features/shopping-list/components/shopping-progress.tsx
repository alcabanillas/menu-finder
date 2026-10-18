import Link from 'next/link';
import { ProgressBar } from '@/features/shopping-list/components/progress-bar';
import { ArrowRight } from '@/shared/ui/arrow-right';
import { buttonClasses } from '@/shared/ui/button';
import { formatDayMonth } from '@/shared/format-week';

/** The current shopping list as the dashboard shows it: its week and counts, none, or not readable. */
export type ListProgress =
  | { kind: 'list'; startsOn: string; checkedCount: number; total: number }
  | { kind: 'none' }
  | { kind: 'failed' };

type ShoppingProgressProps = { list: ListProgress };

// After "Compra" of the design system's `ui_kits/app/HomeScreen.jsx` (version 1792319321-0ddf), with `ProgressBar`. The
// week in the title is the list's own `startsOn`, so it never disagrees with `/shopping-list` (design D2 of MF-25).
const CARD = 'rounded-[12px] border border-border-hairline bg-surface-card px-5 py-4';
const TITLE = 'text-eyebrow font-semibold uppercase tracking-[var(--text-eyebrow--letter-spacing)] text-text-muted';

/** How much of the current shopping list is ticked, and the way to it. */
export function ShoppingProgress({ list }: ShoppingProgressProps) {
  const ready = list.kind === 'list' && list.total > 0;
  return (
    <section aria-labelledby="compra" className={CARD}>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 id="compra" className={TITLE}>
          {list.kind === 'list' ? `Compra · semana del ${formatDayMonth(list.startsOn)}` : 'Compra'}
        </h2>
        {ready && (
          <Link
            href="/shopping-list"
            className={buttonClasses({ variant: 'ghost', size: 'sm', className: 'h-7 px-1 no-underline' })}
          >
            Abrir
            <ArrowRight size={16} />
          </Link>
        )}
      </div>
      <ProgressBody list={list} />
    </section>
  );
}

function ProgressBody({ list }: ShoppingProgressProps) {
  if (list.kind === 'failed') return <p>No se ha podido cargar la lista. Inténtalo de nuevo.</p>;
  if (list.kind === 'none') return <p className="text-small text-text-muted">Aún no hay lista: aparece al elegir un menú.</p>;
  if (list.total === 0) return <p>La lista de este menú no está disponible.</p>;
  return <ProgressBar label="Marcados" value={list.checkedCount} max={list.total} />;
}
