import { describe, expect, it } from 'vitest';
import { cleanTelemetrySpan } from '@/app/sentry-clean-span';

describe('cleanTelemetrySpan', () => {
  it('strips query strings from url.full and drops url.query', () => {
    const span = {
      name: '/menu',
      attributes: {
        'url.full': 'https://menu-finder.app/menu?startsOn=2026-10-12',
        'url.query': 'startsOn=2026-10-12',
        'url.path': '/menu',
        'sentry.op': 'navigation',
      },
    };

    const cleaned = cleanTelemetrySpan(span);

    expect(cleaned.attributes['url.full']).toBe('https://menu-finder.app/menu');
    expect(cleaned.attributes).not.toHaveProperty('url.query');
    expect(cleaned.attributes['url.path']).toBe('/menu');
    expect(cleaned.attributes['sentry.op']).toBe('navigation');
  });

  it('keeps clean URLs intact', () => {
    const span = {
      name: '/planner',
      attributes: {
        'url.full': 'https://menu-finder.app/planner',
        'url.path': '/planner',
      },
    };

    const cleaned = cleanTelemetrySpan(span);

    expect(cleaned.attributes['url.full']).toBe('https://menu-finder.app/planner');
    expect(cleaned.attributes['url.path']).toBe('/planner');
  });

  it('handles spans with empty or missing attributes gracefully', () => {
    const span = { name: 'internal-operation' };

    const cleaned = cleanTelemetrySpan(span);

    expect(cleaned.name).toBe('internal-operation');
    expect(cleaned).toEqual({ name: 'internal-operation' });
  });

  it('strips query string from http.url and http.target if present', () => {
    const span = {
      name: 'GET /menu?startsOn=2026-10-12',
      attributes: {
        'http.url': 'https://menu-finder.app/menu?startsOn=2026-10-12',
        'http.target': '/menu?startsOn=2026-10-12',
      },
    };

    const cleaned = cleanTelemetrySpan(span);

    expect(cleaned.attributes['http.url']).toBe('https://menu-finder.app/menu');
    expect(cleaned.attributes['http.target']).toBe('/menu');
  });

  it('drops sensitive user, cookie or header attributes if present', () => {
    const span = {
      name: '/planner',
      attributes: {
        'url.full': 'https://menu-finder.app/planner',
        user: { id: 'usr-123', email: 'test@example.com' },
        cookies: 'session=secret',
        headers: { authorization: 'Bearer xyz' },
      },
    };

    const cleaned = cleanTelemetrySpan(span);

    expect(cleaned.attributes).not.toHaveProperty('user');
    expect(cleaned.attributes).not.toHaveProperty('cookies');
    expect(cleaned.attributes).not.toHaveProperty('headers');
  });
});
