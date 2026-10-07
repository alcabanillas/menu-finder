import { redirect } from 'next/navigation';
import type { SignedInUser } from '@/application/dto/signed-in-user';
import { sessionUser } from '@/app/_session/session-user';

/**
 * The first line of every protected page (design D6): the user of a valid session, or a redirect to `/login` before
 * the page reads or renders anything. Not in a layout: layouts do not run again on navigation.
 */
export async function requireUser(): Promise<SignedInUser> {
  const user = await sessionUser();
  if (!user) redirect('/login');
  return user;
}

/** For the pages that show the sign-in form: a signed-in user has nothing to do there. */
export async function redirectIfSignedIn(): Promise<void> {
  if (await sessionUser()) redirect('/planner');
}
