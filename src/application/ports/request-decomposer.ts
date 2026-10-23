import { z } from 'zod';
import { REJECTION_CATEGORIES } from '@/application/dto/decomposition';
import { constraintSchema } from '@/application/dto/search-request';
import type { Result } from '@/shared/result';

export type DecomposerFailure = { kind: 'decomposer-failed'; reason: string };

/**
 * What the model must answer: a structure, or a rejection with no constraints or groups (MF-40.2 design D2). It is
 * the contract of this port: the adapter asks the model for this shape, and `decomposeText` validates the
 * answer with it, because the model may not keep to it.
 */
export const decompositionSchema = z.strictObject({
  rejection: z.enum(REJECTION_CATEGORIES).nullable(),
  constraints: z.array(constraintSchema),
  sameDish: z.array(z.array(z.string())),
  anyOf: z.array(z.array(z.string())),
});

/**
 * The model that turns the text of a request into a decomposition (BUS-descomponedor, MF-40.2 design D1). No
 * existing port covers text generation: `EmbeddingsPort` only embeds. The answer is what the model said, not
 * trusted: `decomposeText` validates it.
 */
export interface RequestDecomposer {
  /** One call to the model, with the request as delimited data. A failure of the call or a timeout is an error. */
  decompose(request: string): Promise<Result<unknown, DecomposerFailure>>;
}
