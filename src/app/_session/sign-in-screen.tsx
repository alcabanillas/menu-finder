import { signInAction } from '@/app/_session/actions';
import { LoginForm } from '@/features/auth/components/login-form';
import { SignInHero } from '@/features/auth/components/sign-in-hero';
import { Wordmark } from '@/features/auth/components/wordmark';

/**
 * The sign-in screen `/` and `/login` share until the home and the dashboard exist, as in the design system's Login
 * mock (version 1791192451-31e6). From 640 px of width it has two columns; the form comes first in the DOM, so
 * keyboard and screen readers start there, and the olive panel is moved to the left.
 */
export function SignInScreen() {
  return (
    <div className="@container min-h-screen">
      <div className="flex min-h-screen flex-col @min-[640px]:grid @min-[640px]:grid-cols-2">
        <main className="flex flex-1 flex-col px-gutter-mobile pt-5 pb-8 @min-[640px]:justify-center @min-[640px]:p-10 @min-[960px]:p-14">
          <Wordmark className="text-[22px] @min-[640px]:hidden" />
          <div className="mx-auto flex w-full max-w-[400px] flex-col gap-7 pt-14 @min-[640px]:pt-0">
            <header>
              <p className="text-eyebrow text-olive-600 uppercase">Acceso</p>
              <h1 className="mt-1.5 text-h1 text-text-strong">Accede a tu menú</h1>
              <p className="mt-2.5 text-text-muted">Con tu correo y tu contraseña.</p>
              <hr className="mt-[18px] border-0 border-t border-border-ink" />
            </header>
            <LoginForm action={signInAction} />
          </div>
        </main>
        <SignInHero className="order-first hidden @min-[640px]:flex" />
      </div>
    </div>
  );
}
