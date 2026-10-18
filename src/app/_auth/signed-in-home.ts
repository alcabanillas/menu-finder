/**
 * Where a signed-in user lands after the sign-in or when opening `/login`: always this literal, never a value from the
 * request, so there is no open redirect (design D5 of MF-25).
 */
export const SIGNED_IN_HOME = '/';
