'use client';

import { useActionState, useState, type FormEvent } from 'react';
import { Button } from '@/features/auth/components/button';
import { FormAlert } from '@/features/auth/components/form-alert';
import { PasswordField } from '@/features/auth/components/password-field';
import { TextField } from '@/features/auth/components/text-field';
import { checkSignInFields, type SignInFieldErrors } from '@/features/auth/sign-in-fields';

/** What the sign-in action answers: a message to show, or none, and the number of the answer. */
export type LoginFormState = { message: string | null; attempt: number };

type LoginFormProps = { action: (previous: LoginFormState, form: FormData) => Promise<LoginFormState> };

const INITIAL_STATE: LoginFormState = { message: null, attempt: 0 };
const NO_ERRORS: SignInFieldErrors = { email: null, password: null };

/**
 * Email and password, sent to the server action it receives. No sign-up and no recovery (SEG-sistema-cerrado).
 * The fields are checked before sending, as help; without JavaScript the form still posts and the server validates.
 */
export function LoginForm({ action }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? checkSignInFields(email, password) : NO_ERRORS;

  const stopIfInvalid = (event: FormEvent<HTMLFormElement>) => {
    setSubmitted(true);
    if (hasErrors(checkSignInFields(email, password))) event.preventDefault();
  };

  return (
    <form action={formAction} onSubmit={stopIfInvalid} noValidate className="flex w-full flex-col gap-[18px]">
      {/* A new element on every answer (`attempt`), so a repeated message is announced again. */}
      {state.message && <FormAlert key={state.attempt} message={state.message} />}
      <TextField
        label="Correo electrónico"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="nombre@correo.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={errors.email}
        disabled={pending}
      />
      <PasswordField
        label="Contraseña"
        name="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={errors.password}
        disabled={pending}
      />
      <Button type="submit" size="lg" fullWidth disabled={pending} className="mt-1.5">
        {pending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  );
}

function hasErrors(errors: SignInFieldErrors): boolean {
  return errors.email !== null || errors.password !== null;
}
