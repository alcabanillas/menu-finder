/** Temporary: throws while rendering so the Vercel preview shows the error.tsx fallback and its Sentry event (task 6.2). Remove before merge. */
export default async function Boom() {
  await Promise.resolve();
  throw new Error('boom: forced render error for task 6.2');
}
