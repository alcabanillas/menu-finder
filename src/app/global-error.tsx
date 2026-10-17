'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

type GlobalErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

const PAGE_STYLE = {
  fontFamily: 'system-ui, sans-serif',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '16px',
  padding: '96px 16px',
  textAlign: 'center',
} as const;

/**
 * What the app shows when the root layout itself throws. It replaces the layout, so it brings its own document and none
 * of the global styles or the font (design.md D5). Same rules as `error.tsx`: reported once, nothing about the error shown.
 */
export default function GlobalError({ error, retry }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <main role="alert" style={PAGE_STYLE}>
          <h1>Algo ha fallado</h1>
          <p>No hemos podido mostrar la aplicación. Inténtalo de nuevo o recarga.</p>
          <button type="button" onClick={retry}>
            Intentar de nuevo
          </button>
        </main>
      </body>
    </html>
  );
}
