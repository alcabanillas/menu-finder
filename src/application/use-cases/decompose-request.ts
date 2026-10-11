import { z } from 'zod';
import type { DecomposeError, RejectionCategory } from '@/application/dto/decomposition';
import type { SearchRequestDto, SearchRequestIssue } from '@/application/dto/search-request';
import { decompositionSchema, type RequestDecomposer } from '@/application/ports/request-decomposer';
import { parseSearchRequest } from '@/application/use-cases/search-menus';
import { termsNotInRequest } from '@/domain/search/request-terms';
import { err, ok, type Result } from '@/shared/result';

export type DecomposeRequestDeps = { decomposer: RequestDecomposer };

/** About 2.5 times the longest request of the decomposer golden set, 115 characters (MF-40.2 design D5). */
export const MAX_REQUEST_LENGTH = 300;

type Decomposition = z.output<typeof decompositionSchema>;

/**
 * Turns the text of a request into a search structure with one call to the model, with no retry (BUS-descomponedor,
 * spec request-decomposer). An answer that does not validate is refused, never repaired (safety-first §2.6).
 */
export async function decomposeRequest(
  request: string,
  { decomposer }: DecomposeRequestDeps,
): Promise<Result<SearchRequestDto, DecomposeError>> {
  const text = request.trim();
  const length = [...text].length;
  if (length === 0) return err({ kind: 'request-too-short' });
  if (length > MAX_REQUEST_LENGTH) return err({ kind: 'request-too-long', max: MAX_REQUEST_LENGTH });
  const answer = await decomposer.decompose(text);
  if (!answer.ok) return answer;
  return readAnswer(text, answer.value);
}

// The order of design D2: shape, rejection, empty structure, then the rules of the search and the terms.
function readAnswer(text: string, answer: unknown): Result<SearchRequestDto, DecomposeError> {
  const parsed = decompositionSchema.safeParse(answer);
  if (!parsed.success) return invalid(parsed.error.issues.map((issue) => toIssue(answer, issue)));
  const { rejection, ...structure } = parsed.data;
  if (rejection !== null) return readRejection(rejection, structure);
  if (isEmpty(structure)) return ok(structure);
  const valid = parseSearchRequest(structure);
  if (!valid.ok) return invalid(valid.error.issues);
  const invented = termsNotInRequest(text, structure.constraints);
  if (invented.length > 0) return invalid(invented.map(termNotInRequest));
  return ok(structure);
}

// Names the field that failed; for a constraint, its id too, read from the unvalidated answer.
function toIssue(answer: unknown, issue: z.core.$ZodIssue): SearchRequestIssue {
  const keys = issue.code === 'unrecognized_keys' ? issue.keys.join(', ') : undefined;
  const [first, position, ...rest] = issue.path;
  if (first === 'constraints' && typeof position === 'number') {
    const field = keys ?? (rest.length > 0 ? rest.join('.') : 'constraints');
    return { constraint: constraintIdAt(answer, position), field, message: issue.message };
  }
  return { field: keys ?? (first === undefined ? 'answer' : String(first)), message: issue.message };
}

function constraintIdAt(answer: unknown, position: number): string {
  const id = (answer as { constraints: { id?: unknown }[] }).constraints[position]?.id;
  return typeof id === 'string' ? id : `#${position}`;
}

function invalid(issues: SearchRequestIssue[]): Result<never, DecomposeError> {
  return err({ kind: 'invalid-answer', issues });
}

// A rejection is either a structure or a rejection, never both.
function readRejection(
  category: RejectionCategory,
  structure: Omit<Decomposition, 'rejection'>,
): Result<never, DecomposeError> {
  if (!isEmpty(structure)) {
    return invalid([{ field: 'rejection', message: 'a rejection has no constraints or groups' }]);
  }
  return err({ kind: 'rejected', category });
}

// A search the four types cannot hold ("platos para el finde"): valid, and not a rejection (design D3).
function isEmpty({ constraints, sameDish, anyOf }: Omit<Decomposition, 'rejection'>): boolean {
  return constraints.length === 0 && sameDish.length === 0 && anyOf.length === 0;
}

function termNotInRequest(constraint: string): SearchRequestIssue {
  return { constraint, field: 'term', message: 'the term is not in the request' };
}
