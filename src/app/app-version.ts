/**
 * The version the running app was built from: the `version` of package.json, inlined by next.config.ts (MF-26 design
 * D6). Read only on the server, so it reaches the browser only inside the account menu of a signed-in user.
 */
export const APP_VERSION = process.env.APP_VERSION ?? '';
