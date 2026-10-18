import { redirectIfSignedIn } from '@/app/_auth/require-user';
import { signInAction } from '@/app/_auth/actions';
import { SignInScreen } from '@/features/auth/components/sign-in-screen';

/** `/login`: the sign-in form, or the home for a user who is already signed in. */
export default async function LoginPage() {
  await redirectIfSignedIn();
  return <SignInScreen action={signInAction} />;
}
