import { cache } from 'react';
import type { SignedInUser } from '@/application/dto/signed-in-user';
import { webContainer } from '@/composition/web-container';

/**
 * The user of the request's session, or null. Wrapped in React's `cache()`, so the layout, the page and the redirect
 * checks of one request share one lookup (design D1 of MF-51.2). It only reads: who may see a page is decided by
 * `requireUser()`.
 */
export const sessionUser: () => Promise<SignedInUser | null> = cache(() => webContainer().currentUser());
