import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { AlertIcon } from '@/features/auth/components/alert-icon';

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string;
  error?: string | null;
  /** A control shown inside the field, on the right (the password's "Mostrar"). */
  trailing?: ReactNode;
};

// Ported from the `LoginField` of the design system's Login mock (version 1791192451-31e6).
const INPUT =
  'h-12 w-full rounded-md border border-gray-500 bg-surface-card px-3.5 text-base text-text-strong ' +
  'transition-[border-color,box-shadow] duration-[var(--dur-base)] ease-out placeholder:text-text-faint ' +
  'focus-visible:border-ink focus-visible:shadow-[0_0_0_1px_var(--color-ink)] focus-visible:outline-none ' +
  'aria-invalid:border-terracotta-600 aria-invalid:shadow-[0_0_0_1px_var(--color-terracotta-600)] ' +
  'disabled:bg-surface-sunken disabled:text-text-muted';

/** A labelled text input with its error under it, linked for assistive technology. */
export function TextField({ label, error, trailing, className, ...inputProps }: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-small font-semibold text-text-strong">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={[INPUT, trailing && 'pr-[92px]', className].filter(Boolean).join(' ')}
          {...inputProps}
        />
        {trailing}
      </div>
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-small text-terracotta-600">
          <AlertIcon size={16} className="mt-0.5" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
