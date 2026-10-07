import { SignInScreen } from '@/app/_session/sign-in-screen';
import { webContainer } from '@/composition/web-container';
import { AppShell } from '@/features/app-shell/components/app-shell';

/**
 * `/`: the sign-in form for a visitor; for a user with a session, a minimal page inside the app shell until MF-25
 * builds the dashboard. It is outside the `(app)` route group because it also serves the visitor, so it mounts the shell
 * itself (design D11 of MF-51.1).
 */
export default async function Home() {
  if (await webContainer().currentUser()) return <TodayPage />;
  return <SignInScreen />;
}

function TodayPage() {
  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center gap-6 px-5 py-16">
        <h1 className="text-2xl font-extrabold">Hoy</h1>
        <p>Aquí verás qué toca hoy.</p>
      </div>
    </AppShell>
  );
}
