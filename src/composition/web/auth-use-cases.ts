import { currentUser } from '@/application/use-cases/auth/current-user';
import { signIn, type SignInInput } from '@/application/use-cases/auth/sign-in';
import { signOut } from '@/application/use-cases/auth/sign-out';
import { forwardedClientIp } from '@/infrastructure/http/forwarded-client-ip';
import type { Deps } from './infrastructure-deps';
import type { RequestHeaders } from './request-headers';

/** The use cases of the session. async, so that a missing variable is a rejected promise like any other failure. */
export function authUseCases(lazyDeps: () => Deps, requestHeaders: RequestHeaders) {
  return {
    signIn: async (input: SignInInput) =>
      signIn(lazyDeps(), { ...input, clientIp: await forwardedClientIp(requestHeaders) }),
    signOut: async () => signOut(lazyDeps()),
    currentUser: async () => currentUser(lazyDeps()),
  };
}
