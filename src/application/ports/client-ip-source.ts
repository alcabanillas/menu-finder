/** The network address of the client making the request, for rate limiting (SEG-rate-limit). */
export interface ClientIpSource {
  /** Resolves the IP address of the client from the incoming request context. */
  clientIp(): Promise<string>;
}
