import { SignInScreen } from '@/app/_session/sign-in-screen';
import { signOutAction } from '@/app/_session/actions';
import { sessionUser } from '@/app/_session/session-user';
import { AppShell } from '@/features/app-shell/components/app-shell';

/**
 * `/`: the sign-in form for a visitor; for a user with a session, a minimal page inside the app shell until MF-25
 * builds the dashboard. It is outside the `(signed-in)` route group because it also serves the visitor, so it mounts the shell
 * itself (design D11 of MF-51.1).
 */
export default async function Home() {
  const user = await sessionUser();
  if (user) return <TodayPage email={user.email} />;
  return <SignInScreen />;
}

function TodayPage({ email }: { email: string }) {
  return (
    <AppShell account={{ email, signOutAction }}>
      <div className="flex flex-col items-center justify-center gap-6 px-5 py-16">
        <h1 className="text-2xl font-extrabold">Hoy</h1>
        <p>Aquí verás qué toca hoy.</p>
      </div>
    </AppShell>
  );
}
