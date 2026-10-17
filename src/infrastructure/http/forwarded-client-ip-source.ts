import type { ClientIpSource } from '@/application/ports/client-ip-source';
import { forwardedClientIp } from './forwarded-client-ip';

type RequestHeaders = () => Promise<Headers>;

/** Resolves client IP address from forwarded HTTP request headers for rate limiting. */
export class ForwardedClientIpSource implements ClientIpSource {
  constructor(private readonly requestHeaders: RequestHeaders) {}

  async clientIp(): Promise<string> {
    return forwardedClientIp(this.requestHeaders);
  }
}
