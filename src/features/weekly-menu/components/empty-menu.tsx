import Link from 'next/link';

type EmptyMenuProps = { reason: 'none' | 'failed' };

const LINK =
  'font-semibold text-olive-600 underline decoration-2 underline-offset-[3px] hover:text-olive-700 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

/** `/menu` with nothing to show: no menu chosen for this week, or the menu could not be read. */
export function EmptyMenu({ reason }: EmptyMenuProps) {
  return (
    <div className="mx-auto flex w-full max-w-[var(--spacing-content-max)] flex-col gap-4 px-gutter-mobile py-6">
      <h1 className="text-h1 font-extrabold">Menú</h1>
      {reason === 'none' ? (
        <>
          <p>Todavía no has elegido menú para esta semana.</p>
          <p>
            <Link href="/planner" className={LINK}>
              Elegir menú
            </Link>
          </p>
        </>
      ) : (
        <p className="text-text-muted">No se ha podido cargar tu menú.</p>
      )}
    </div>
  );
}
