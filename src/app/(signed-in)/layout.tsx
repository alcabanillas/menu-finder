import type { ReactNode } from 'react';
import { signOutAction } from '@/app/_session/actions';
import { sessionUser } from '@/app/_session/session-user';
import { AppShell } from '@/features/app-shell/components/app-shell';

/**
 * The shell of every page with a session (MF-51.1). It reads the user only to show the email in the account menu
 * (MF-51.2). It is NOT where the session is checked: a layout does not run again on client navigation, so a check here
 * would be skipped after the first page. Each page inside calls `requireUser()` itself, and `protected-pages.test.ts`
 * fails for any page that does not. Without a session the shell gets no account and is in its visitor variant, and the
 * layout does not redirect: the page does, before the browser draws anything (design D5 of MF-51.2).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await sessionUser();
  return <AppShell account={user ? { email: user.email, signOutAction } : undefined}>{children}</AppShell>;
}
