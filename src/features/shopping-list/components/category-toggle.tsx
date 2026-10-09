import type { ShoppingChecklistCategoryDto } from '@/application/dto/shopping-checklist';
import { CategoryTickForm } from '@/features/shopping-list/components/category-tick-form';
import { Checkbox, type CheckboxState } from '@/features/shopping-list/components/checkbox';
import type { TickForm } from '@/features/shopping-list/components/checklist-row';

type CategoryToggleProps = { menuNumber: number; category: ShoppingChecklistCategoryDto; form: TickForm };

// Ported from the "Marcar todos" button of the design system's `ui_kits/app/ShoppingScreen.jsx` (version 1791390572-4ab7).
/** Ticks every item of the category, or unticks them all when they are all ticked. */
export function CategoryToggle({ menuNumber, category, form }: CategoryToggleProps) {
  const state = toggleState(category);
  return (
    <CategoryTickForm menuNumber={menuNumber} category={category} form={form} className="border-b border-border-hairline">
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
          {category.checkedCount}/{category.items.length}
        </span>
      </button>
    </CategoryTickForm>
  );
}

/** Whether all, some or none of the category's items are ticked, as `aria-checked` says it. */
export function toggleState({ checkedCount, items }: ShoppingChecklistCategoryDto): CheckboxState {
  if (checkedCount === items.length) return 'true';
  return checkedCount > 0 ? 'mixed' : 'false';
}
