import type { Result } from '@/shared/result';

export type DecomposerFailure = { kind: 'decomposer-failed'; reason: string };

/**
 * The model that turns the text of a request into a decomposition (BUS-descomponedor, MF-40.2 design D1). No
 * existing port covers text generation: `EmbeddingsPort` only embeds. The answer is what the model said, not
 * trusted: `decomposeRequest` validates it.
 */
export interface RequestDecomposer {
  /** One call to the model, with the request as delimited data. A failure of the call or a timeout is an error. */
  decompose(request: string): Promise<Result<unknown, DecomposerFailure>>;
}
