'use server';

import { redirect } from 'next/navigation';
import type { SignInFailure } from '@/application/use-cases/sign-in';
import { webContainer } from '@/composition/web-container';
import type { LoginFormState } from '@/features/auth/components/login-form';

// One message for every wrong-credentials case, so the page does not tell which emails have an account.
const MESSAGES: Record<SignInFailure['kind'], string> = {
  'email-required': 'Escribe tu correo.',
  'password-required': 'Escribe tu contraseña.',
  'wrong-credentials': 'El correo o la contraseña no coinciden.',
  'rate-limited': 'Demasiados intentos. Espera unos minutos.',
  failed: 'No se ha podido iniciar sesión. Inténtalo de nuevo.',
};

/**
 * The sign-in form's action. On success it always goes to `/planner`: no redirect target is read from the request, so
 * there is no open redirect.
 */
export async function signInAction(previous: LoginFormState, form: FormData): Promise<LoginFormState> {
  const result = await webContainer().signIn({ email: fieldOf(form, 'email'), password: fieldOf(form, 'password') });
  // The attempt number gives the form a new alert on every answer, so a repeated message is announced again (MF-47.2).
  if (!result.ok) return { message: MESSAGES[result.error.kind], attempt: previous.attempt + 1 };
  redirect('/planner');
}

/** The account menu's sign-out action: revokes the session and goes back to the home. */
export async function signOutAction(): Promise<void> {
  await webContainer().signOut();
  redirect('/');
}

// A field the request did not carry is `undefined`, never `null`, so the use case sees it as missing.
function fieldOf(form: FormData, name: string): FormDataEntryValue | undefined {
  return form.get(name) ?? undefined;
}
