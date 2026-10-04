import { signInAction } from '@/app/_session/actions';
import { LoginForm } from '@/features/auth/components/login-form';

/** The sign-in screen `/` and `/login` share until the home and the dashboard exist. */
export function SignInScreen() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-5">
      <h1 className="text-2xl font-extrabold">Menu Finder</h1>
      <LoginForm action={signInAction} />
    </main>
  );
}
