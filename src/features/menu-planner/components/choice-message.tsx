import type { ChoiceState } from '@/features/menu-planner/choice-view';

/** "Eligiendo…" while a choice runs, or the message of a choice that stored nothing. */
export function ChoiceMessage({ choice, choosing }: { choice: ChoiceState; choosing: boolean }) {
  if (choosing) {
    return (
      <p role="status" className="m-0 text-text-muted">
        Eligiendo…
      </p>
    );
  }
  if (choice.status !== 'failed') return null;
  // A new element on every answer (`attempt`), so a repeated message is announced again.
  return (
    <p key={choice.attempt} role="alert" className="m-0 text-terracotta-700">
      {choice.message}
    </p>
  );
}
