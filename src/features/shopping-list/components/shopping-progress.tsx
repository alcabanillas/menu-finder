import Link from 'next/link';
import { ProgressBar } from '@/features/shopping-list/components/progress-bar';
import { buttonClasses } from '@/shared/ui/button';

/** The current shopping list as the dashboard shows it: its counts, none, or not readable. */
export type ListProgress = { kind: 'list'; checkedCount: number; total: number } | { kind: 'none' } | { kind: 'failed' };

type ShoppingProgressProps = { list: ListProgress };

// After "Compra" of the design system's `ui_kits/app/HomeScreen.jsx` (version 1792255497-a1ff), with `ProgressBar`.
const EYEBROW = 'text-eyebrow font-semibold uppercase tracking-[var(--text-eyebrow--letter-spacing)] text-text-muted';

/** How much of the current shopping list is ticked, and the way to it. */
export function ShoppingProgress({ list }: ShoppingProgressProps) {
  return (
    <section aria-labelledby="lista-de-la-semana" className="flex flex-col gap-4">
      <div className="flex items-end gap-3 border-b border-border-ink pb-2">
        <div className="min-w-0 flex-1">
          <p className={EYEBROW}>Compra</p>
          <h2 id="lista-de-la-semana" className="text-[22px] font-extrabold leading-[1.2] text-text-strong">
            Lista de la semana
          </h2>
        </div>
        {list.kind === 'list' && list.total > 0 && (
          <Link href="/shopping-list" className={buttonClasses({ variant: 'ghost', size: 'sm', className: 'no-underline' })}>
            Abrir
          </Link>
        )}
      </div>
      <ProgressBody list={list} />
    </section>
  );
}

function ProgressBody({ list }: ShoppingProgressProps) {
  if (list.kind === 'failed') return <p>No se ha podido cargar la lista. Inténtalo de nuevo.</p>;
  if (list.kind === 'none') return <p>Aún no tienes lista de la compra.</p>;
  if (list.total === 0) return <p>La lista de este menú no está disponible.</p>;
  return <ProgressBar label="Ítems marcados" value={list.checkedCount} max={list.total} />;
}
