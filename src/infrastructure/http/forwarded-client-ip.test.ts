import { describe, expect, it } from 'vitest';
import { forwardedClientIp } from '@/infrastructure/http/forwarded-client-ip';

const requestWith = (init: Record<string, string>) => async () => new Headers(init);

describe('forwardedClientIp', () => {
  it('takes the first address of x-forwarded-for, trimmed', async () => {
    const ip = await forwardedClientIp(requestWith({ 'x-forwarded-for': ' 203.0.113.195 , 70.41.3.18' }));

    expect(ip).toBe('203.0.113.195');
  });

  it('falls back to x-real-ip when x-forwarded-for has no first address', async () => {
    const ip = await forwardedClientIp(requestWith({ 'x-forwarded-for': ' , 70.41.3.18', 'x-real-ip': '198.51.100.7' }));

    expect(ip).toBe('198.51.100.7');
  });

  it('reads x-real-ip when there is no x-forwarded-for', async () => {
    const ip = await forwardedClientIp(requestWith({ 'x-real-ip': '198.51.100.7' }));

    expect(ip).toBe('198.51.100.7');
  });

  it('answers the loopback address when the request carries neither header', async () => {
    const ip = await forwardedClientIp(requestWith({}));

    expect(ip).toBe('127.0.0.1');
  });
});
