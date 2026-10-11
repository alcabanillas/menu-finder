import type { Metadata } from 'next';
import { Archivo } from 'next/font/google';
import { connection } from 'next/server';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: 'Menu Finder',
  description: 'Elige el menú de la semana entre los menús de tu nutricionista.',
};

// The design system's only family (UI-design-system). Variable font: one file covers the 400, 600 and 800 it uses.
// Self-hosted by Next.js at build time: the browser never calls Google.
const archivo = Archivo({ subsets: ['latin'], style: ['normal', 'italic'], display: 'swap', variable: '--font-archivo' });

/**
 * The HTML shell every page renders inside. It waits for the incoming request, so every page renders per request: the
 * nonce of the Content-Security-Policy exists only then, and a page prerendered at build time would carry none on its
 * scripts (MF-26 design D2). It also keeps the build from reading the session, so the build needs no secrets.
 */
export default async function RootLayout({ children }: LayoutProps<'/'>) {
  await connection();
  return (
    <html lang="es" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
