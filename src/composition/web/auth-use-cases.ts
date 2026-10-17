import { currentUser } from '@/application/use-cases/auth/current-user';
import { signIn, type SignInInput } from '@/application/use-cases/auth/sign-in';
import { signOut } from '@/application/use-cases/auth/sign-out';
import type { Deps } from './infrastructure-deps';

/** The use cases of the session. async, so that a missing variable is a rejected promise like any other failure. */
export function authUseCases(lazyDeps: () => Deps) {
  return {
    signIn: async (input: SignInInput) => signIn(lazyDeps(), input),
    signOut: async () => signOut(lazyDeps()),
    currentUser: async () => currentUser(lazyDeps()),
  };
}
