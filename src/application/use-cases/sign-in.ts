import { z } from 'zod';
import type { AuditLog, SignInRefusal } from '@/application/ports/audit-log';
import type { RateLimiter } from '@/application/ports/rate-limiter';
import {
  MAX_EMAIL_LENGTH,
  MAX_PASSWORD_LENGTH,
  type Credentials,
  type SessionManager,
  type SignedInUser,
} from '@/application/ports/session-manager';
import { err, ok, type Result } from '@/shared/result';

/** What a form or a direct call sends: nothing about its shape is trusted. */
export type SignInInput = { email?: unknown; password?: unknown; clientIp?: string };

/** `failed` is a fault of the system, not of the user, and is not logged as a refusal. */
export type SignInFailure =
  | { kind: 'email-required' }
  | { kind: 'password-required' }
  | { kind: 'wrong-credentials' }
  | { kind: 'rate-limited'; resetAt: Date }
  | { kind: 'failed' };

type Deps = { sessions: SessionManager; auditLog: AuditLog; rateLimiter: RateLimiter };

const WRONG_CREDENTIALS = { kind: 'wrong-credentials' } as const;
const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_SECONDS = 900; // 15 minutes

// A null byte cannot be part of any account and PostgreSQL rejects it, so it is refused before any query.
const NO_NULL_BYTE = (value: string) => !value.includes('\u0000');

const credentialsSchema = z.object({
  email: z.string().max(MAX_EMAIL_LENGTH).refine(NO_NULL_BYTE),
  password: z.string().max(MAX_PASSWORD_LENGTH).refine(NO_NULL_BYTE),
});

/**
 * Starts a session from the sign-in form. Enforces brute-force rate limiting per client IP and account.
 * A value that cannot belong to any account is answered like wrong credentials.
 */
export async function signIn(
  deps: Deps,
  input: SignInInput,
): Promise<Result<SignedInUser, SignInFailure>> {
  const missing = missingField(input);
  if (missing) return err(missing);

  const key = rateLimitKey(input.clientIp, input.email);
  const status = await deps.rateLimiter.check(key, MAX_FAILED_ATTEMPTS);
  if (!status.allowed) {
    deps.auditLog.record({ type: 'sign-in-refused', reason: 'rate-limited', at: new Date() });
    return err({ kind: 'rate-limited', resetAt: status.resetAt });
  }

  const credentials = credentialsSchema.safeParse({ email: normalizeEmail(input.email), password: input.password });
  if (!credentials.success) {
    await deps.rateLimiter.hit(key, { limit: MAX_FAILED_ATTEMPTS, windowSeconds: WINDOW_SECONDS });
    return refuse(deps.auditLog, 'invalid-input');
  }

  return startSession(deps, key, credentials.data);
}

function missingField({ email, password }: SignInInput): SignInFailure | null {
  if (email === undefined || (typeof email === 'string' && email.trim() === '')) return { kind: 'email-required' };
  if (password === undefined || password === '') return { kind: 'password-required' };
  return null;
}

function normalizeEmail(email: unknown): unknown {
  return typeof email === 'string' ? email.normalize('NFC').trim() : email;
}

function rateLimitKey(clientIp = 'unknown', email: unknown): string {
  const account = typeof email === 'string' && email.trim() !== ''
    ? email.normalize('NFC').trim().toLowerCase()
    : 'anonymous';
  return `login:failed:${clientIp}:${account}`;
}

async function startSession(
  { sessions, auditLog, rateLimiter }: Deps,
  key: string,
  credentials: Credentials,
): Promise<Result<SignedInUser, SignInFailure>> {
  const started = await sessions.signIn(credentials);
  if (started.ok) {
    await rateLimiter.reset(key);
    auditLog.record({ type: 'sign-in', userId: started.value.userId, at: new Date() });
    return ok(started.value);
  }
  if (started.error.kind === WRONG_CREDENTIALS.kind) {
    await rateLimiter.hit(key, { limit: MAX_FAILED_ATTEMPTS, windowSeconds: WINDOW_SECONDS });
    return refuse(auditLog, WRONG_CREDENTIALS.kind);
  }
  return err({ kind: 'failed' });
}

function refuse(auditLog: AuditLog, reason: SignInRefusal): Result<never, SignInFailure> {
  auditLog.record({ type: 'sign-in-refused', reason, at: new Date() });
  return err(WRONG_CREDENTIALS);
}
