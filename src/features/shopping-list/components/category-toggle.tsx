import type { ShoppingChecklistCategoryDto } from '@/application/dto/shopping-checklist';
import { Checkbox, type CheckboxState } from '@/features/shopping-list/components/checkbox';
import type { TickForm } from '@/features/shopping-list/components/checklist-row';

type CategoryToggleProps = { menuNumber: number; category: ShoppingChecklistCategoryDto; form: TickForm };

// Ported from the "Marcar todos" button of the design system's `ui_kits/app/ShoppingScreen.jsx` (version 1791390572-4ab7).
/** Ticks every item of the category, or unticks them all when they are all ticked. The form lists every position. */
export function CategoryToggle({ menuNumber, category, form }: CategoryToggleProps) {
  const total = category.items.length;
  const all = category.checkedCount === total;
  const state = toggleState(category.checkedCount, total);
  return (
    <form action={form.action} onSubmit={form.onSubmit} className="border-b border-border-hairline">
      <input type="hidden" name="menuNumber" value={menuNumber} />
      {category.items.map((item) => (
        <input key={item.position} type="hidden" name="position" value={item.position} />
      ))}
      <input type="hidden" name="checked" value={String(!all)} />
      <button
        type="submit"
        role="checkbox"
        aria-checked={state}
        aria-label={`Marcar todos: ${category.name}`}
        className="flex min-h-11 w-full cursor-pointer items-center gap-3.5 rounded-xs text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <Checkbox state={state} />
        <span className="flex-1 text-small font-semibold text-text-strong">Marcar todos</span>
        <span className="text-caption tabular-nums text-text-muted">
          {category.checkedCount}/{total}
        </span>
      </button>
    </form>
  );
}

function toggleState(checkedCount: number, total: number): CheckboxState {
  if (checkedCount === total) return 'true';
  return checkedCount > 0 ? 'mixed' : 'false';
}
