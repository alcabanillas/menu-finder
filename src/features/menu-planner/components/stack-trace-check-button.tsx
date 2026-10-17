'use client';

import { Button } from '@/shared/ui/button';

// Temporary (MF-22.6): it throws from a click handler, so the error reaches the browser's global handler and Sentry with a
// stack trace that names this file. Removed in the same change once the check is done in production.
/** "Lanzar error de prueba". */
export function StackTraceCheckButton() {
  return (
    <Button variant="secondary" size="sm" className="self-start" onClick={throwCheckError}>
      Lanzar error de prueba
    </Button>
  );
}

function throwCheckError(): never {
  throw new Error('MF-22.6 stack trace check');
}
