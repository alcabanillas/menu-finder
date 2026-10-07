import type { FormEvent } from 'react';
import type { ShoppingChecklistItemDto } from '@/application/dto/shopping-checklist';
import { Checkbox } from '@/features/shopping-list/components/checkbox';
import { formatAmount } from '@/features/shopping-list/format-amount';

/** What every tick form gets: the action for the no-JavaScript post and the handler that shows the tick at once. */
export type TickForm = {
  action: (form: FormData) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

type ChecklistRowProps = { menuNumber: number; item: ShoppingChecklistItemDto; form: TickForm };

// Ported from the design system's `components/forms/Checkbox.jsx` row (version 1791390572-4ab7).
/** One item as a form with a single checkbox button; it posts the new value, so it works without JavaScript. */
export function ChecklistRow({ menuNumber, item, form }: ChecklistRowProps) {
  const amount = formatAmount(item.quantity, item.unit);
  return (
    <form action={form.action} onSubmit={form.onSubmit} className="border-b border-border-hairline">
      <input type="hidden" name="menuNumber" value={menuNumber} />
      <input type="hidden" name="position" value={item.position} />
      <input type="hidden" name="checked" value={String(!item.checked)} />
      <button
        type="submit"
        role="checkbox"
        aria-checked={item.checked}
        aria-label={[item.name, item.optional && 'opcional', amount].filter(Boolean).join(' ')}
        className="flex min-h-12 w-full cursor-pointer items-center gap-3.5 rounded-xs text-left select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <Checkbox state={item.checked ? 'true' : 'false'} />
        <span className={`min-w-0 flex-1 text-body ${item.checked ? 'text-text-faint line-through' : 'text-text-strong'}`}>
          {item.name}
          {item.optional && (
            <>
              {' '}
              <span className="text-[13px] italic text-text-muted no-underline">opcional</span>
            </>
          )}
        </span>
        {amount && <span className="whitespace-nowrap text-small tabular-nums text-text-muted"> {amount}</span>}
      </button>
    </form>
  );
}
