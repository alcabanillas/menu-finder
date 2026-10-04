import type { AuditLog } from '@/application/ports/audit-log';
import type { SessionManager } from '@/application/ports/session-manager';

/** Revokes the current session and logs it. Without a session there is nothing to revoke, and it does not fail. */
export async function signOut({ sessions, auditLog }: { sessions: SessionManager; auditLog: AuditLog }): Promise<void> {
  const { userId } = await sessions.signOut();
  auditLog.record({ type: 'sign-out', userId, at: new Date() });
}
