import type { AuditEvent, AuditLog } from '@/application/ports/audit-log';

type WriteLine = (line: string) => void;

/**
 * One JSON line per event on the server output, which Vercel keeps with the function logs. Only the fields of the
 * event type are copied, so nothing a caller adds by mistake reaches the log. Sentry comes in MF-32.
 */
export class StdoutAuditLog implements AuditLog {
  constructor(private readonly write: WriteLine = (line) => process.stdout.write(line)) {}

  record(event: AuditEvent): void {
    this.write(`${JSON.stringify(toLine(event))}\n`);
  }
}

function toLine(event: AuditEvent): Record<string, string | null> {
  const at = event.at.toISOString();
  switch (event.type) {
    case 'sign-in':
      return { event: 'auth.sign-in', userId: event.userId, at };
    case 'sign-in-refused':
      return { event: 'auth.sign-in-refused', reason: event.reason, at };
    case 'sign-out':
      return { event: 'auth.sign-out', userId: event.userId, at };
  }
}
