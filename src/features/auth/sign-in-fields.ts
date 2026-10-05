// Checks of the sign-in form before it sends anything (MF-47.2). Help for the user, not a control: they only look at
// what was typed, and the server validates the sign-in on its own (spec authentication).

/** The message to show under each field, or null when the field is fine. */
export type SignInFieldErrors = { email: string | null; password: string | null };

const WHITESPACE = /\s/;

/** What is wrong with each field of the sign-in form. */
export function checkSignInFields(email: string, password: string): SignInFieldErrors {
  return { email: emailError(email.trim()), password: password ? null : 'Escribe tu contraseña.' };
}

function emailError(email: string): string | null {
  if (!email) return 'Escribe tu correo.';
  return hasAddressShape(email) ? null : 'Revisa el formato del correo.';
}

// The design system's Login mock rule (`/^\S+@\S+\.\S+$/`: text, `@`, text, a dot, text, with no spaces), written
// without that regex, whose backtracking grows faster than the input (sonarjs/super-linear-regex).
function hasAddressShape(email: string): boolean {
  if (WHITESPACE.test(email)) return false;
  const at = email.indexOf('@');
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  return at > 0 && dot > 0 && dot < domain.length - 1;
}
