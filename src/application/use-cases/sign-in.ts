import { z } from 'zod';
import type { AuditLog, SignInRefusal } from '@/application/ports/audit-log';
import {
  MAX_EMAIL_LENGTH,
  MAX_PASSWORD_LENGTH,
  type Credentials,
  type SessionManager,
  type SignedInUser,
} from '@/application/ports/session-manager';
import { err, ok, type Result } from '@/shared/result';

/** What a form or a direct call sends: nothing about its shape is trusted. */
export type SignInInput = { email?: unknown; password?: unknown };

/** `failed` is a fault of the system, not of the user, and is not logged as a refusal. */
export type SignInFailure =
  | { kind: 'email-required' }
  | { kind: 'password-required' }
  | { kind: 'wrong-credentials' }
  | { kind: 'failed' };

type Deps = { sessions: SessionManager; auditLog: AuditLog };

const WRONG_CREDENTIALS = { kind: 'wrong-credentials' } as const;

// A null byte cannot be part of any account and PostgreSQL rejects it, so it is refused before any query.
const NO_NULL_BYTE = (value: string) => !value.includes('\u0000');

const credentialsSchema = z.object({
  email: z.string().max(MAX_EMAIL_LENGTH).refine(NO_NULL_BYTE),
  password: z.string().max(MAX_PASSWORD_LENGTH).refine(NO_NULL_BYTE),
});

/**
 * Starts a session from the sign-in form. A value that cannot belong to any account is answered like wrong
 * credentials, so the answer does not tell which rule failed; the log keeps the difference.
 */
export async function signIn(
  { sessions, auditLog }: Deps,
  input: SignInInput,
): Promise<Result<SignedInUser, SignInFailure>> {
  const missing = missingField(input);
  if (missing) return err(missing);

  const credentials = credentialsSchema.safeParse({ email: normalizeEmail(input.email), password: input.password });
  if (!credentials.success) return refuse(auditLog, 'invalid-input');

  return startSession({ sessions, auditLog }, credentials.data);
}

function missingField({ email, password }: SignInInput): SignInFailure | null {
  if (email === undefined || (typeof email === 'string' && email.trim() === '')) return { kind: 'email-required' };
  if (password === undefined || password === '') return { kind: 'password-required' };
  return null;
}

function normalizeEmail(email: unknown): unknown {
  return typeof email === 'string' ? email.normalize('NFC').trim() : email;
}

async function startSession(
  { sessions, auditLog }: Deps,
  credentials: Credentials,
): Promise<Result<SignedInUser, SignInFailure>> {
  const started = await sessions.signIn(credentials);
  if (started.ok) {
    auditLog.record({ type: 'sign-in', userId: started.value.userId, at: new Date() });
    return ok(started.value);
  }
  return started.error.kind === WRONG_CREDENTIALS.kind ? refuse(auditLog, WRONG_CREDENTIALS.kind) : err({ kind: 'failed' });
}

function refuse(auditLog: AuditLog, reason: SignInRefusal): Result<never, SignInFailure> {
  auditLog.record({ type: 'sign-in-refused', reason, at: new Date() });
  return err(WRONG_CREDENTIALS);
}
