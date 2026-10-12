import { disableGenkitOTelInitialization } from 'genkit/tracing';

/**
 * Genkit 1.42 starts OpenTelemetry on its first action; outside `genkit start` (`GENKIT_ENV=dev`) it stays off, so no
 * tracer provider is registered in production (MF-40.4). Call it before the instance runs its first action.
 */
export function configureGenkitTelemetry(genkitEnv = process.env.GENKIT_ENV): void {
  if (genkitEnv !== 'dev') disableGenkitOTelInitialization();
}
