import { useId } from 'react';
import type { ShoppingChecklistCategoryDto } from '@/application/dto/shopping-checklist';
import { CategoryTickForm } from '@/features/shopping-list/components/category-tick-form';
import { toggleState } from '@/features/shopping-list/components/category-toggle';
import { Checkbox } from '@/features/shopping-list/components/checkbox';
import type { TickForm } from '@/features/shopping-list/components/checklist-row';

/** A category of the index and the `id` of its section in the list. */
export type IndexEntry = { category: ShoppingChecklistCategoryDto; anchor: string };

type CategoryIndexProps = { menuNumber: number; entries: IndexEntry[]; form: TickForm };

// After `.mf-shop__ix` in the design system's `ui_kits/app/ShoppingScreen.jsx` (version 1791414282-6467), with the
// full category names (design D6 of MF-56) and plain anchors instead of `scrollIntoView` (design D4).
const ROW = 'flex min-h-10 items-center gap-3 border-b border-border-hairline py-1';
const TICK =
  'flex cursor-pointer rounded-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
const LINK =
  'min-w-0 flex-1 rounded-xs py-1 text-sm font-medium leading-[1.35] no-underline hover:underline ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

/**
 * The categories of the view beside the list: each with its tick-every-item control, a link to its section and its
 * count. It is the only tick-every-item control from 800 px (design D5 of MF-56).
 */
export function CategoryIndex({ menuNumber, entries, form }: CategoryIndexProps) {
  const labelId = useId();
  return (
    <nav aria-labelledby={labelId}>
      <p
        id={labelId}
        className="border-b border-border-ink pb-2 text-eyebrow font-semibold uppercase tracking-[var(--text-eyebrow--letter-spacing)] text-text-muted"
      >
        Categorías
      </p>
      <ul>
        {entries.map(({ category, anchor }) => (
          <li key={anchor} className={ROW}>
            <CategoryTickForm menuNumber={menuNumber} category={category} form={form} className="flex">
              <button
                type="submit"
                role="checkbox"
                aria-checked={toggleState(category)}
                aria-label={`Marcar todos: ${category.name}`}
                className={TICK}
              >
                <Checkbox state={toggleState(category)} />
              </button>
            </CategoryTickForm>
            <a href={`#${anchor}`} className={`${LINK} ${isDone(category) ? 'text-text-muted' : 'text-text-strong'}`}>
              {category.name}
            </a>
            <span className="text-caption tabular-nums text-text-muted">
              {category.checkedCount}/{category.items.length}
            </span>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function isDone(category: ShoppingChecklistCategoryDto): boolean {
  return category.checkedCount === category.items.length;
}
