import { describe, expect, it } from 'vitest';
import { groupHits, matchConstraints } from '@/domain/evaluation/decomposition-score';
import type { Constraint } from '@/domain/search/search-request';

const constraint = (id: string, term: string, overrides: Partial<Constraint> = {}): Constraint => ({
  id,
  type: 'literal',
  term,
  polarity: 'include',
  hard: false,
  ...overrides,
});

const pairIds = (pairs: ReturnType<typeof matchConstraints>) => pairs.map(({ expected, answered }) => [expected.id, answered.id]);

describe('matchConstraints', () => {
  it('pairs a constraint with the same term, type and polarity, whatever its case and spaces', () => {
    const expected = [constraint('c1', 'cerdo', { type: 'exclusion', polarity: 'exclude' })];
    const answered = [constraint('a1', ' Cerdo ', { type: 'exclusion', polarity: 'exclude' })];

    expect(pairIds(matchConstraints(expected, answered))).toEqual([['c1', 'a1']]);
  });

  it('does not pair the same term with another type', () => {
    const expected = [constraint('c1', 'pescado')];
    const answered = [constraint('a1', 'pescado', { type: 'fuzzy' })];

    expect(matchConstraints(expected, answered)).toEqual([]);
  });

  it('does not pair the same term with another polarity', () => {
    const expected = [constraint('c1', 'fritos', { type: 'fuzzy', polarity: 'exclude' })];
    const answered = [constraint('a1', 'fritos', { type: 'fuzzy' })];

    expect(matchConstraints(expected, answered)).toEqual([]);
  });

  it('does not pair a shorter term', () => {
    const expected = [constraint('c1', 'de cuchara', { type: 'fuzzy' })];
    const answered = [constraint('a1', 'cuchara', { type: 'fuzzy' })];

    expect(matchConstraints(expected, answered)).toEqual([]);
  });

  it('pairs each expected constraint once', () => {
    const expected = [constraint('c1', 'pollo')];
    const answered = [constraint('a1', 'pollo'), constraint('a2', 'pollo')];

    expect(pairIds(matchConstraints(expected, answered))).toEqual([['c1', 'a1']]);
  });

  it('ignores hard and slot', () => {
    const expected = [constraint('c1', 'rápidas', { type: 'attribute', slot: 'dinner' })];
    const answered = [constraint('a1', 'rápidas', { type: 'attribute', hard: true })];

    expect(pairIds(matchConstraints(expected, answered))).toEqual([['c1', 'a1']]);
  });
});

describe('groupHits', () => {
  const expected = [constraint('c1', 'arroz'), constraint('c2', 'carne', { type: 'exclusion', polarity: 'exclude' })];
  const answered = [constraint('a1', 'arroz'), constraint('a2', 'carne', { type: 'exclusion', polarity: 'exclude' })];
  const pairs = matchConstraints(expected, answered);

  it('counts a group whose paired constraints form an expected group', () => {
    expect(groupHits([['c1', 'c2']], [['a2', 'a1']], pairs)).toBe(1);
  });

  it('does not count a group with an unpaired member', () => {
    const onlyRice = matchConstraints(expected.slice(0, 1), answered);

    expect(groupHits([['c1', 'c2']], [['a1', 'a2']], onlyRice)).toBe(0);
  });

  it('does not count a group with an extra member', () => {
    const three = [...expected, constraint('c3', 'patatas')];
    const answeredThree = [...answered, constraint('a3', 'patatas')];

    expect(groupHits([['c1', 'c2']], [['a1', 'a2', 'a3']], matchConstraints(three, answeredThree))).toBe(0);
  });

  it('counts an expected group once', () => {
    expect(groupHits([['c1', 'c2']], [['a1', 'a2'], ['a2', 'a1']], pairs)).toBe(1);
  });
});
