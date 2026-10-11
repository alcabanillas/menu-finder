import type { Constraint } from '@/domain/search/search-request';

/**
 * The ids of the constraints whose term is not in the request text, both trimmed and compared in lowercase. A term
 * is the user's own words (spec decomposer-golden-set): the decomposer must not invent one or replace it with a
 * concept, which is the search's job (BUS-descomponedor).
 */
export function termsNotInRequest(text: string, constraints: Pick<Constraint, 'id' | 'term'>[]): string[] {
  const request = normalized(text);
  return constraints.filter(({ term }) => !request.includes(normalized(term))).map(({ id }) => id);
}

function normalized(text: string): string {
  return text.trim().toLowerCase();
}
