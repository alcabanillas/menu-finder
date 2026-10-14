/** The headers of the request being served; in the web, `headers` from `next/headers`. */
type RequestHeaders = () => Promise<Headers>;

// Neither header: a local request with no proxy in front, as in `next dev`.
const LOOPBACK = '127.0.0.1';

/**
 * The address of the client behind the proxy, for the sign-in rate limit (SEG-rate-limit): the first address of
 * `x-forwarded-for`, which the proxy sets, then `x-real-ip`.
 */
export async function forwardedClientIp(requestHeaders: RequestHeaders): Promise<string> {
  const headers = await requestHeaders();
  return firstForwarded(headers) || headers.get('x-real-ip') || LOOPBACK;
}

function firstForwarded(headers: Headers): string | undefined {
  return headers.get('x-forwarded-for')?.split(',')[0].trim();
}
