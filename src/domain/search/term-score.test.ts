import { describe, expect, it } from 'vitest';
import { hybridScore, matchesTerm, MATCH_THRESHOLD, rescaleSimilarities } from '@/domain/search/term-score';

describe('rescaleSimilarities', () => {
  it('gives 0 to the least similar dish, 1 to the most similar and scales the rest between them', () => {
    const scores = rescaleSimilarities([0.4, 0.6, 0.8]);

    expect(scores[0]).toBe(0);
    expect(scores[1]).toBeCloseTo(0.5, 10);
    expect(scores[2]).toBe(1);
  });

  it('keeps the order of the dishes it receives', () => {
    expect(rescaleSimilarities([0.8, 0.4])).toEqual([1, 0]);
  });

  it('gives 0 to every dish when the term has the same similarity with all of them', () => {
    expect(rescaleSimilarities([0.5, 0.5, 0.5])).toEqual([0, 0, 0]);
  });

  it('gives no score when there is no dish', () => {
    expect(rescaleSimilarities([])).toEqual([]);
  });
});

describe('hybridScore', () => {
  it('is the mean of the lexical and the semantic score', () => {
    expect(hybridScore(1, 0.5)).toBe(0.75);
  });

  it('is 0.5 for a dish with no lexical match and the highest semantic score', () => {
    expect(hybridScore(0, 1)).toBe(0.5);
  });
});

describe('matchesTerm', () => {
  it('uses 0.5 for lexical and semantic and 0.75 for hybrid', () => {
    expect(MATCH_THRESHOLD).toEqual({ lexical: 0.5, semantic: 0.5, hybrid: 0.75 });
  });

  it.each([
    ['lexical', 1, true],
    ['lexical', 0, false],
    ['semantic', 0.5, true],
    ['semantic', 0.49, false],
    ['hybrid', 0.75, true],
    ['hybrid', 0.74, false],
  ] as const)('with %s, a score of %d matches: %s', (strategy, score, expected) => {
    expect(matchesTerm(score, strategy)).toBe(expected);
  });

  it('compares the score rounded to two decimals, so floating-point error does not move the threshold', () => {
    const [, middle] = rescaleSimilarities([0.4, 0.6, 0.8]);

    expect(matchesTerm(middle, 'semantic')).toBe(true);
  });

  it('never matches in the hybrid a dish with no lexical match', () => {
    expect(matchesTerm(hybridScore(0, 1), 'hybrid')).toBe(false);
  });

  it('matches in the hybrid a dish with lexical 1 and semantic 0.5', () => {
    expect(matchesTerm(hybridScore(1, 0.5), 'hybrid')).toBe(true);
  });
});
