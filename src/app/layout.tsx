import type { Metadata } from 'next';
import { Archivo } from 'next/font/google';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: 'Menu Finder',
  description: 'Elige el menú de la semana entre los menús de tu nutricionista.',
};

// The design system's only family (UI-design-system). Variable font: one file covers the 400, 600 and 800 it uses.
// Self-hosted by Next.js at build time: the browser never calls Google.
const archivo = Archivo({ subsets: ['latin'], style: ['normal', 'italic'], display: 'swap', variable: '--font-archivo' });

/** The HTML shell every page renders inside. */
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
