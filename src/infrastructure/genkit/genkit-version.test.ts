import { describe, expect, it } from 'vitest';
import { dependencies } from '../../../package.json';

// `configureGenkitTelemetry` relies on `disableGenkitOTelInitialization`, hidden and "unstable" in Genkit 1.42.0.
const PINNED = '1.42.0';
const WHY =
  'MF-40.4: Genkit is pinned at 1.42.0 because configureGenkitTelemetry uses a hidden switch. ' +
  'Genkit 1.43 no longer starts OpenTelemetry on its own (PR #6336): decide again whether the call can go.';

describe('Genkit version', () => {
  it('stays at exactly 1.42.0', () => {
    expect(
      { genkit: dependencies.genkit, '@genkit-ai/google-genai': dependencies['@genkit-ai/google-genai'] },
      WHY,
    ).toEqual({ genkit: PINNED, '@genkit-ai/google-genai': PINNED });
  });
});
