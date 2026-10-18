'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button } from '@/shared/ui/button';

type PageErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

/**
 * What a page shows when it throws while rendering, inside the root layout. The error goes to Sentry once; the screen
 * says nothing about it, because its message can carry internals (error-reporting spec, "Render errors reach Sentry").
 */
export default function PageError({ error, retry }: PageErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold text-text-strong">Algo ha fallado</h1>
      <p>No hemos podido mostrar esta página. Inténtalo de nuevo o recarga.</p>
      <Button onClick={retry}>Intentar de nuevo</Button>
    </main>
  );
}
