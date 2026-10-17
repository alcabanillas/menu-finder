const SENSITIVE_ATTRIBUTES = ['user', 'cookies', 'headers', 'url.query'] as const;
const URL_ATTRIBUTES = ['url.full', 'http.url', 'http.target'] as const;

/**
 * Strips query strings and sensitive attributes from a telemetry span before sending to Sentry.
 * Guards nutritionist and user data (SEG-datos-nutricionista, MF-67 design D1).
 */
export function cleanTelemetrySpan<T extends object>(span: T): T {
  if (!('attributes' in span) || !span.attributes || typeof span.attributes !== 'object') {
    return span;
  }

  const attributes: Record<string, unknown> = { ...(span.attributes as Record<string, unknown>) };

  stripSensitiveAttributes(attributes);
  sanitizeUrlAttributes(attributes);

  return {
    ...span,
    attributes,
  };
}

function stripSensitiveAttributes(attributes: Record<string, unknown>): void {
  for (const key of SENSITIVE_ATTRIBUTES) {
    delete attributes[key];
  }
}

function sanitizeUrlAttributes(attributes: Record<string, unknown>): void {
  for (const key of URL_ATTRIBUTES) {
    const value = attributes[key];
    if (typeof value === 'string') {
      attributes[key] = stripQueryString(value);
    }
  }
}

function stripQueryString(url: string): string {
  const queryIndex = url.indexOf('?');
  return queryIndex === -1 ? url : url.slice(0, queryIndex);
}
