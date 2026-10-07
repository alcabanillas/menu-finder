/**
 * What a page needs of the signed-in user, and nothing more (safety-first §2.2). The email is the user's own and is
 * shown only in the account menu; it is never logged.
 */
export type SignedInUser = { userId: string; name: string; email: string };
