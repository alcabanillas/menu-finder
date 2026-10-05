'use client';

import { useState, type ComponentProps } from 'react';
import { TextField } from '@/features/auth/components/text-field';

type PasswordFieldProps = Omit<ComponentProps<typeof TextField>, 'type' | 'trailing'>;

const TOGGLE =
  'absolute right-1 top-0.5 h-11 cursor-pointer rounded-pill px-3 text-small font-semibold text-olive-600 ' +
  'hover:enabled:bg-gray-100 focus-visible:outline-2 focus-visible:outline-ink disabled:cursor-not-allowed';

/** A password field with a "Mostrar"/"Ocultar" control, as in the design system's Login mock. Hidden on every load. */
export function PasswordField({ disabled, ...fieldProps }: PasswordFieldProps) {
  const [shown, setShown] = useState(false);

  return (
    <TextField
      {...fieldProps}
      type={shown ? 'text' : 'password'}
      disabled={disabled}
      trailing={
        <button
          type="button"
          aria-pressed={shown}
          disabled={disabled}
          onClick={() => setShown(!shown)}
          className={TOGGLE}
        >
          {shown ? 'Ocultar' : 'Mostrar'}
        </button>
      }
    />
  );
}
