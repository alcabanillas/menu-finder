export type SignInRefusal = 'wrong-credentials' | 'invalid-input';

/**
 * A sensitive action, written so that it can be traced later (safety-first P7). There is no field for an email, a
 * password or a token: they cannot reach the log (safety-first §4).
 */
export type AuditEvent =
  | { type: 'sign-in'; userId: string; at: Date }
  | { type: 'sign-in-refused'; reason: SignInRefusal; at: Date }
  | { type: 'sign-out'; userId: string | null; at: Date };

/** Where sensitive actions are recorded. */
export interface AuditLog {
  /** Records one event. */
  record(event: AuditEvent): void;
}
