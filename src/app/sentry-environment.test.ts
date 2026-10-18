import { describe, expect, it } from 'vitest';
import { sentryEnvironment } from '@/app/sentry-environment';

describe('sentryEnvironment', () => {
  it.each(['production', 'preview', 'development'])('uses VERCEL_ENV when it is %s', (vercelEnv) => {
    expect(sentryEnvironment({ VERCEL_ENV: vercelEnv, NODE_ENV: 'production' })).toBe(vercelEnv);
  });

  it('falls back to NODE_ENV outside Vercel', () => {
    expect(sentryEnvironment({ NODE_ENV: 'development' })).toBe('development');
  });

  it('falls back to NODE_ENV when VERCEL_ENV is empty, never an empty string', () => {
    expect(sentryEnvironment({ VERCEL_ENV: '', NODE_ENV: 'production' })).toBe('production');
  });

  it('is development when neither variable is set', () => {
    expect(sentryEnvironment({})).toBe('development');
  });
});
