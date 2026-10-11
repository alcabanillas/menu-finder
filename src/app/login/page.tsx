import { redirectIfSignedIn } from '@/app/_session/require-user';
import { signInAction } from '@/app/_session/actions';
import { SignInScreen } from '@/features/auth/components/sign-in-screen';

/** `/login`: the sign-in form, or `/planner` for a user who is already signed in. */
export default async function LoginPage() {
  await redirectIfSignedIn();
  return <SignInScreen action={signInAction} />;
}
