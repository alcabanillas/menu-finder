export type CheckboxState = 'true' | 'false' | 'mixed';

const TONES: Record<CheckboxState, string> = {
  true: 'border-olive-500 bg-olive-500 text-white',
  mixed: 'border-olive-500 bg-surface-card text-olive-600',
  false: 'border-border-strong bg-surface-card',
};

// Ported from the design system's `components/forms/Checkbox.jsx` (version 1791390572-4ab7): only the box. The row or
// the category toggle around it is the real control, a submit button, so the box is decorative.
/** The 22 px box: empty, with a tick, or with a dash for a partly ticked category. */
export function Checkbox({ state }: { state: CheckboxState }) {
  const full = state === 'true';
  const classes = [
    'inline-flex size-[22px] flex-none items-center justify-center rounded-xs border-[1.5px]',
    'transition-colors duration-[var(--dur-fast)] ease-out',
    TONES[state],
  ].join(' ');
  return (
    <span aria-hidden="true" className={classes}>
      {state !== 'false' && (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {full ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M6 12h12" />}
        </svg>
      )}
    </span>
  );
}
