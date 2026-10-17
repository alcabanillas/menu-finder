import { describe, expect, it } from 'vitest';
import type { ClientIpSource } from '@/application/ports/client-ip-source';
import { ForwardedClientIpSource } from '@/infrastructure/http/forwarded-client-ip-source';

const requestWith = (init: Record<string, string>) => async () => new Headers(init);

describe('ForwardedClientIpSource', () => {
  it('resolves the first address of x-forwarded-for, trimmed', async () => {
    const source: ClientIpSource = new ForwardedClientIpSource(
      requestWith({ 'x-forwarded-for': ' 203.0.113.195 , 70.41.3.18' }),
    );

    expect(await source.clientIp()).toBe('203.0.113.195');
  });

  it('falls back to x-real-ip when x-forwarded-for has no first address', async () => {
    const source: ClientIpSource = new ForwardedClientIpSource(
      requestWith({ 'x-forwarded-for': ' , 70.41.3.18', 'x-real-ip': '198.51.100.7' }),
    );

    expect(await source.clientIp()).toBe('198.51.100.7');
  });

  it('reads x-real-ip when there is no x-forwarded-for', async () => {
    const source: ClientIpSource = new ForwardedClientIpSource(
      requestWith({ 'x-real-ip': '198.51.100.7' }),
    );

    expect(await source.clientIp()).toBe('198.51.100.7');
  });

  it('answers the loopback address when the request carries neither header', async () => {
    const source: ClientIpSource = new ForwardedClientIpSource(requestWith({}));

    expect(await source.clientIp()).toBe('127.0.0.1');
  });
});
