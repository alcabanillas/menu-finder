import Link from 'next/link';

export type ChecklistView = 'all' | 'pending';

const VIEWS: { view: ChecklistView; label: string; href: string }[] = [
  { view: 'all', label: 'Todo', href: '/shopping-list' },
  { view: 'pending', label: 'Por comprar', href: '/shopping-list?vista=por-comprar' },
];

// Styled like the `Chip` of the design system (version 1791390572-4ab7). Links, so the view is in the address.
/** The two views, all and still to buy: two links, the active one marked with `aria-current`. */
export function ViewFilter({ view }: { view: ChecklistView }) {
  return (
    <nav aria-label="Vista de la lista" className="flex gap-2">
      {VIEWS.map((option) => {
        const active = option.view === view;
        return (
          <Link
            key={option.view}
            href={option.href}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center rounded-pill border px-4 text-small font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
              active ? 'border-ink bg-ink text-white' : 'border-border-strong text-text-strong hover:bg-surface-hover'
            }`}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
