import { signOutAction } from '@/app/_auth/actions';
import { APP_VERSION } from '@/app/app-version';
import type { SignedInUser } from '@/application/dto/signed-in-user';
import type { Account } from '@/features/app-shell/components/account-menu';

/** The account of the shell's menu for a user, or none for a visitor (the shell's visitor variant). */
export function shellAccountOf(user: SignedInUser | null): Account | undefined {
  return user ? { email: user.email, version: APP_VERSION, signOutAction } : undefined;
}
