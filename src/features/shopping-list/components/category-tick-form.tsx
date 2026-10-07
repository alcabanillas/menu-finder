import type { ReactNode } from 'react';
import type { ShoppingChecklistCategoryDto } from '@/application/dto/shopping-checklist';
import type { TickForm } from '@/features/shopping-list/components/checklist-row';

type CategoryTickFormProps = {
  menuNumber: number;
  category: ShoppingChecklistCategoryDto;
  form: TickForm;
  className?: string;
  /** The submit button, drawn by the caller. */
  children: ReactNode;
};

/**
 * The form that ticks every item of a category, or unticks them all when they are all ticked: it lists every position.
 * The "Marcar todos" row and the category index post the same fields (design D4 of MF-56).
 */
export function CategoryTickForm({ menuNumber, category, form, className, children }: CategoryTickFormProps) {
  const all = category.checkedCount === category.items.length;
  return (
    <form action={form.action} onSubmit={form.onSubmit} className={className}>
      <input type="hidden" name="menuNumber" value={menuNumber} />
      {category.items.map((item) => (
        <input key={item.position} type="hidden" name="position" value={item.position} />
      ))}
      <input type="hidden" name="checked" value={String(!all)} />
      {children}
    </form>
  );
}
