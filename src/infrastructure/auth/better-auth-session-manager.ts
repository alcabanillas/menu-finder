import type {
  Credentials,
  SessionManager,
  SignedInUser,
  SignInError,
} from '@/application/ports/session-manager';
import type { createAuth } from '@/infrastructure/auth/create-auth';
import { err, ok, type Result } from '@/shared/result';

type Auth = ReturnType<typeof createAuth>;

/** The headers of the request being served; in the web, `headers` from `next/headers`. */
type RequestHeaders = () => Promise<Headers>;

const CLIENT_ERRORS = { min: 400, max: 499 };

/**
 * The session through the library's server calls, never its HTTP routes (MF-20.3 design D1). The cookies of the
 * response are written by the library's `nextCookies` plugin, so sign-in and sign-out must run in a server action.
 */
export class BetterAuthSessionManager implements SessionManager {
  constructor(
    private readonly auth: Auth,
    private readonly requestHeaders: RequestHeaders,
  ) {}

  async signIn(credentials: Credentials): Promise<Result<SignedInUser, SignInError>> {
    try {
      const { user } = await this.auth.api.signInEmail({ body: credentials, headers: await this.requestHeaders() });
      return ok(toSignedInUser(user));
    } catch (error) {
      return err(toSignInError(error));
    }
  }

  async signOut(): Promise<{ userId: string | null }> {
    const user = await this.current();
    await this.auth.api.signOut({ headers: await this.requestHeaders() });
    return { userId: user?.userId ?? null };
  }

  async current(): Promise<SignedInUser | null> {
    const session = await this.auth.api.getSession({ headers: await this.requestHeaders() });
    return session ? toSignedInUser(session.user) : null;
  }
}

function toSignedInUser(user: { id: string; name: string }): SignedInUser {
  return { userId: user.id, name: user.name };
}

// Every refusal of the request (wrong password, unknown email, a value the library rejects) is one answer, so the
// page cannot tell them apart; anything else is a fault of the system.
function toSignInError(error: unknown): SignInError {
  const status = (error as { statusCode?: number } | null)?.statusCode ?? 0;
  if (status >= CLIENT_ERRORS.min && status <= CLIENT_ERRORS.max) return { kind: 'wrong-credentials' };
  return { kind: 'failed', reason: error instanceof Error ? error.message : 'unknown error' };
}
