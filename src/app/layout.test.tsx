import { describe, expect, it, vi } from 'vitest';
import RootLayout from '@/app/layout';

const server = vi.hoisted(() => ({ connection: vi.fn(async () => {}) }));
vi.mock('next/server', () => server);
vi.mock('next/font/google', () => ({ Archivo: () => ({ variable: 'font-archivo' }) }));

describe('RootLayout', () => {
  // A static page would be built without the nonce of the CSP on its scripts, and the browser would block them all
  // (MF-26 design D2). Waiting for the request makes every page render per request, whatever the page reads.
  it('waits for the incoming request, so no page is prerendered at build time', async () => {
    await RootLayout({ children: null } as LayoutProps<'/'>);

    expect(server.connection).toHaveBeenCalledTimes(1);
  });
});
