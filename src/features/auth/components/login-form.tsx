'use client';

import { useActionState } from 'react';

/** What the sign-in action answers: a message to show, or none. */
export type LoginFormState = { message: string | null };

type LoginFormProps = { action: (previous: LoginFormState, form: FormData) => Promise<LoginFormState> };

const INITIAL_STATE: LoginFormState = { message: null };

/** Email and password, sent to the server action it receives. No sign-up and no recovery (SEG-sistema-cerrado). */
export function LoginForm({ action }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1">
        Email
        <input name="email" type="email" autoComplete="email" required className="rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1">
        Contraseña
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded border px-3 py-2"
        />
      </label>
      {state.message && (
        <p role="alert" className="text-sm">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="rounded-full border px-4 py-2 font-semibold">
        Entrar
      </button>
    </form>
  );
}
