import { redirectIfSignedIn } from '@/app/_session/require-user';
import { SignInScreen } from '@/app/_session/sign-in-screen';

/** `/login`: the sign-in form, or `/planner` for a user who is already signed in. */
export default async function LoginPage() {
  await redirectIfSignedIn();
  return <SignInScreen />;
}
