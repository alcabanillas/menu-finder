import { PlannerIcon } from '@/features/menu-planner/components/planner-icon';

/** What the chip needs from the choice: the form it posts to, whether a choice runs and, if a menu would be replaced, how to ask. */
export type RandomProps = { formId: string; disabled: boolean; onAsk?: () => void };

// After the chip "Al azar" of the design system's `PlannerScreen.jsx` (version 1792443153-9554): the first suggestion, with
// an ink border and a dice. It submits the choose form with `random`: the server picks the menu for the selected week.
// When the week has a menu, with JavaScript the question comes first (`onAsk`); without it the chip posts.
export const CHIP =
  'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-pill border bg-surface-card px-3.5 text-sm text-text-strong ' +
  'transition-colors duration-[var(--dur-base)] hover:enabled:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-45';

/** "Al azar". */
export function RandomChip({ formId, disabled, onAsk }: RandomProps) {
  return (
    <button
      type="submit"
      name="random"
      value="1"
      form={formId}
      disabled={disabled}
      className={`${CHIP} border-border-ink font-semibold`}
      onClick={
        onAsk
          ? (event) => {
              event.preventDefault();
              onAsk();
            }
          : undefined
      }
    >
      <PlannerIcon name="dices" size={15} />
      Al azar
    </button>
  );
}
