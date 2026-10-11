import type { Constraint } from '@/domain/search/search-request';

/** An answered constraint and the expected constraint it hits. */
export type ConstraintPair = { expected: Constraint; answered: Constraint };

/**
 * Pairs each answered constraint with the first unpaired expected constraint of the same term (trimmed, lowercased),
 * type and polarity: one to one, so a term answered twice is one hit and one miss (MF-40.3 design D2). `hard` and
 * `slot` do not decide a hit; they are scored on the pairs.
 */
export function matchConstraints(expected: Constraint[], answered: Constraint[]): ConstraintPair[] {
  const unpaired = [...expected];
  const pairs: ConstraintPair[] = [];
  for (const candidate of answered) {
    const index = unpaired.findIndex((wanted) => sameMeaning(wanted, candidate));
    if (index === -1) continue;
    pairs.push({ expected: unpaired[index], answered: candidate });
    unpaired.splice(index, 1);
  }
  return pairs;
}

/**
 * Counts the answered groups whose members are all paired and whose expected constraints are exactly one expected
 * group of the same kind. Each expected group counts once.
 */
export function groupHits(expected: string[][], answered: string[][], pairs: ConstraintPair[]): number {
  const expectedIdOf = new Map(pairs.map((pair) => [pair.answered.id, pair.expected.id]));
  const unmatched = expected.map(groupKey);
  let hits = 0;
  for (const group of answered) {
    const translated = group.map((id) => expectedIdOf.get(id));
    if (translated.some((id) => id === undefined)) continue;
    const index = unmatched.indexOf(groupKey(translated as string[]));
    if (index === -1) continue;
    hits += 1;
    unmatched.splice(index, 1);
  }
  return hits;
}

function sameMeaning(wanted: Constraint, candidate: Constraint): boolean {
  return (
    normalized(wanted.term) === normalized(candidate.term) &&
    wanted.type === candidate.type &&
    wanted.polarity === candidate.polarity
  );
}

function normalized(term: string): string {
  return term.trim().toLowerCase();
}

// A group is a set: the order of its ids does not matter.
function groupKey(ids: string[]): string {
  return [...ids].sort().join('\u0000');
}
