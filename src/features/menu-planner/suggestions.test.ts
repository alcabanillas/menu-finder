import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pickSuggestions, SUGGESTIONS } from '@/features/menu-planner/suggestions';

type RetrievalQuery = { id: string; text: string; rule: { kind: string } };

function liveQueries(): string[] {
  const file = join(process.cwd(), 'evals/retrieval/queries.json');
  const queries = JSON.parse(readFileSync(file, 'utf8')) as RetrievalQuery[];
  return queries.filter(({ rule }) => rule.kind !== 'withdrawn').map(({ text }) => text);
}

describe('SUGGESTIONS', () => {
  it('has twelve different requests', () => {
    expect(SUGGESTIONS).toHaveLength(12);
    expect(new Set(SUGGESTIONS).size).toBe(12);
  });

  it('holds only requests of the retrieval golden set that are not withdrawn, so that each one returns menus', () => {
    const live = new Set(liveQueries());

    expect(SUGGESTIONS.filter((request) => !live.has(request))).toEqual([]);
  });
});

describe('pickSuggestions', () => {
  const LIST = ['a', 'b', 'c', 'd', 'e', 'f'];

  it('picks four different requests of the list', () => {
    const picked = pickSuggestions(LIST, Math.random);

    expect(picked).toHaveLength(4);
    expect(new Set(picked).size).toBe(4);
    for (const request of picked) expect(LIST).toContain(request);
  });

  it('is decided by the random function it is given, so that a test can fix it', () => {
    expect(pickSuggestions(LIST, () => 0)).toEqual(pickSuggestions(LIST, () => 0));
    expect(pickSuggestions(LIST, () => 0)).not.toEqual(pickSuggestions(LIST, () => 0.99));
  });

  it('gives all of a list shorter than four and does not change the list', () => {
    const short = ['a', 'b'];

    expect(pickSuggestions(short, Math.random).sort()).toEqual(['a', 'b']);
    expect(short).toEqual(['a', 'b']);
  });
});
