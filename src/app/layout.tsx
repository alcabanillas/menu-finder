import type { Metadata } from 'next';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: 'Menu Finder',
  description: 'Elige el menú de la semana entre los menús de tu nutricionista.',
};

/** The HTML shell every page renders inside. */
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
