// The proxy docs call it `unstable_doesProxyMatch`, but next 16.3.8 only exports the middleware-era name.
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { describe, expect, it } from 'vitest';
import nextConfig from '../next.config';
import { config } from '@/proxy';

const runsOn = (url: string, headers?: Record<string, string>) =>
  unstable_doesMiddlewareMatch({ config, nextConfig, url, headers });

describe('proxy matcher', () => {
  it('runs on pages', () => {
    expect(runsOn('/')).toBe(true);
    expect(runsOn('/login')).toBe(true);
    expect(runsOn('/planner')).toBe(true);
  });

  it('skips API routes, static assets and the favicon, which are not HTML documents', () => {
    expect(runsOn('/api/auth/session')).toBe(false);
    expect(runsOn('/_next/static/chunks/app.js')).toBe(false);
    expect(runsOn('/_next/image?url=%2Fa.png&w=64&q=75')).toBe(false);
    expect(runsOn('/favicon.ico')).toBe(false);
  });

  it('skips the prefetches of next/link', () => {
    expect(runsOn('/planner', { 'next-router-prefetch': '1' })).toBe(false);
    expect(runsOn('/planner', { purpose: 'prefetch' })).toBe(false);
  });
});
