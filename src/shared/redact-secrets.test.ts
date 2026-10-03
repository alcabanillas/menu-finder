import { describe, expect, it } from 'vitest';
import { redactSecrets } from '@/shared/redact-secrets';

describe('redactSecrets', () => {
  it('removes the user and password of a connection string', () => {
    const text = 'connect failed: postgresql://owner:s3cr3t@ep-x.eu-central-1.aws.neon.tech/neondb?sslmode=require';

    expect(redactSecrets(text)).toBe('connect failed: postgresql://***@ep-x.eu-central-1.aws.neon.tech/neondb?sslmode=require');
  });

  it('also redacts the postgres:// scheme and every occurrence', () => {
    expect(redactSecrets('a postgres://u:p@h/db b postgres://v:q@h/db')).toBe('a postgres://***@h/db b postgres://***@h/db');
  });

  it('removes every given secret value, wherever it appears', () => {
    expect(redactSecrets('key=abc123 failed (abc123)', ['abc123'])).toBe('key=*** failed (***)');
  });

  it('ignores empty secrets and leaves other text as it is', () => {
    expect(redactSecrets('nothing to hide', ['', undefined])).toBe('nothing to hide');
  });
});
