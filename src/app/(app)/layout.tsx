import type { ReactNode } from 'react';
import { AppShell } from '@/features/app-shell/components/app-shell';

/**
 * The shell of every page with a session (MF-51.1). It is NOT where the session is checked: a layout does not run again
 * on client navigation, so a check here would be skipped after the first page. Each page inside calls `requireUser()`
 * itself, and `protected-pages.test.ts` fails for any page that does not.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
