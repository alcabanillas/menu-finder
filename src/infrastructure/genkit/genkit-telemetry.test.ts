import { disableGenkitOTelInitialization } from 'genkit/tracing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGenkitEmbeddings } from '@/infrastructure/genkit/genkit-embeddings';
import { createGenkitRequestDecomposer } from '@/infrastructure/genkit/genkit-request-decomposer';
import { configureGenkitTelemetry } from '@/infrastructure/genkit/genkit-telemetry';

// Only the public switch is replaced; Genkit's globals are never read (MF-40.4 design D3).
vi.mock('genkit/tracing', () => ({ disableGenkitOTelInitialization: vi.fn() }));

const KEY = 'AIzaFAKE-key-for-tests';

afterEach(() => {
  vi.mocked(disableGenkitOTelInitialization).mockClear();
  vi.unstubAllEnvs();
});

describe('configureGenkitTelemetry', () => {
  it('turns OpenTelemetry off when GENKIT_ENV is not set', () => {
    vi.stubEnv('GENKIT_ENV', undefined);

    configureGenkitTelemetry();

    expect(disableGenkitOTelInitialization).toHaveBeenCalledOnce();
  });

  it('turns OpenTelemetry off when GENKIT_ENV is any value other than dev', () => {
    configureGenkitTelemetry('prod');

    expect(disableGenkitOTelInitialization).toHaveBeenCalledOnce();
  });

  it('leaves OpenTelemetry on under genkit start (GENKIT_ENV=dev)', () => {
    configureGenkitTelemetry('dev');

    expect(disableGenkitOTelInitialization).not.toHaveBeenCalled();
  });
});

describe('Genkit factories', () => {
  it('the decomposer turns OpenTelemetry off when GENKIT_ENV is not set', () => {
    vi.stubEnv('GENKIT_ENV', undefined);

    createGenkitRequestDecomposer(KEY);

    expect(disableGenkitOTelInitialization).toHaveBeenCalledOnce();
  });

  it('the embeddings turn OpenTelemetry off when GENKIT_ENV is not set', () => {
    vi.stubEnv('GENKIT_ENV', undefined);

    createGenkitEmbeddings(KEY);

    expect(disableGenkitOTelInitialization).toHaveBeenCalledOnce();
  });
});
