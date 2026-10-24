import { sessionUser } from '@/app/_auth/session-user';
import { shellAccountOf } from '@/app/_auth/shell-account';
import { dashboardContent } from '@/app/_dashboard/dashboard-content';
import { WelcomeContent } from '@/app/_welcome/welcome-content';
import { AppShell } from '@/features/app-shell/components/app-shell';

/**
 * `/`: two states decided on the server from the session alone (UI-home-sin-login). A visitor gets the informative home
 * in the shell's variant with no session; a signed-in user gets the dashboard. It reads nothing of the request but the
 * session, and it is outside the `(signed-in)` route group because it also serves the visitor (design D11 of MF-51.1).
 */
export default async function Home() {
  const user = await sessionUser();
  return (
    <AppShell account={shellAccountOf(user)}>
      {user ? await dashboardContent(user) : <WelcomeContent />}
    </AppShell>
  );
}
