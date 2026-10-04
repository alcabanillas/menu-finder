import type { SessionManager, SignedInUser } from '@/application/ports/session-manager';

/** The user of the current session, or `null`. Pages read it through here so that they depend on a use case (ADR-001 §5). */
export function currentUser({ sessions }: { sessions: SessionManager }): Promise<SignedInUser | null> {
  return sessions.current();
}
