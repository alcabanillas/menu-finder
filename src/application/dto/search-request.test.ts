import { describe, expect, it } from 'vitest';
import { parseSearchRequest, type SearchRequestDto, type SearchRequestIssue } from '@/application/dto/search-request';

type RawConstraint = Record<string, unknown>;

function constraint(id: string, term: string, overrides: RawConstraint = {}): RawConstraint {
  return { id, type: 'literal', term, polarity: 'include', hard: false, ...overrides };
}

function request(constraints: unknown[], overrides: Record<string, unknown> = {}) {
  return { constraints, sameDish: [], anyOf: [], ...overrides };
}

// The DTO comes from outside and may break its own type, so the tests pass any data through this cast.
function parse(raw: unknown) {
  return parseSearchRequest(raw as SearchRequestDto);
}

function issuesOf(raw: unknown): SearchRequestIssue[] {
  const result = parse(raw);
  if (result.ok) throw new Error('the structure was accepted');
  return result.error.issues;
}

describe('parseSearchRequest', () => {
  describe('accepted structures', () => {
    it('accepts one literal constraint', () => {
      const raw = request([constraint('c1', 'pollo')]);

      const result = parse(raw);

      expect(result).toEqual({ ok: true, value: raw });
    });

    it('accepts a structure without groups', () => {
      const result = parse({ constraints: [constraint('c1', 'pollo')] });

      expect(result).toEqual({ ok: true, value: request([constraint('c1', 'pollo')]) });
    });

    it('accepts the slot, the groups and the limits', () => {
      const twelve = Array.from({ length: 12 }, (_, index) => constraint(`c${index + 1}`, 'x'.repeat(100)));
      const raw = request(twelve, { sameDish: [['c1', 'c2']], anyOf: [['c3', 'c4']] });
      raw.constraints[4] = constraint('c5', 'cena', { slot: 'dinner', hard: true });

      expect(parse(raw).ok).toBe(true);
    });
  });

  describe('terms', () => {
    it('rejects a blank term naming term', () => {
      expect(issuesOf(request([constraint('c1', '   ')]))).toEqual([
        expect.objectContaining({ constraint: 'c1', field: 'term' }),
      ]);
    });

    it('rejects an empty term naming term', () => {
      expect(issuesOf(request([constraint('c1', '')]))).toEqual([
        expect.objectContaining({ constraint: 'c1', field: 'term' }),
      ]);
    });

    it('rejects a term of 101 characters naming term', () => {
      expect(issuesOf(request([constraint('c1', 'x'.repeat(101))]))).toEqual([
        expect.objectContaining({ constraint: 'c1', field: 'term' }),
      ]);
    });

    it('rejects a term that is not a string naming term', () => {
      expect(issuesOf(request([constraint('c1', 'x', { term: 42 })]))).toEqual([
        expect.objectContaining({ constraint: 'c1', field: 'term' }),
      ]);
    });
  });

  describe('constraints', () => {
    it('rejects 13 constraints naming constraints', () => {
      const thirteen = Array.from({ length: 13 }, (_, index) => constraint(`c${index + 1}`, 'pollo'));

      expect(issuesOf(request(thirteen))).toEqual([expect.objectContaining({ field: 'constraints' })]);
    });

    it('rejects a structure with no constraint naming constraints', () => {
      expect(issuesOf(request([]))).toEqual([expect.objectContaining({ field: 'constraints' })]);
    });

    it('rejects a constraint that is not an object naming constraints and its position', () => {
      expect(issuesOf(request(['pollo']))).toEqual([
        expect.objectContaining({ constraint: '#0', field: 'constraints' }),
      ]);
    });

    it('names a constraint without an id by its position', () => {
      const withoutId = { type: 'literal', term: 'pollo', polarity: 'include', hard: false };

      expect(issuesOf(request([withoutId]))).toEqual([expect.objectContaining({ constraint: '#0', field: 'id' })]);
    });

    it('rejects an unknown key of a constraint naming the key', () => {
      expect(issuesOf(request([constraint('c1', 'pollo', { sql: 'DROP TABLE menu' })]))).toEqual([
        expect.objectContaining({ constraint: 'c1', field: 'sql' }),
      ]);
    });

    it('rejects an unknown key of the structure naming the key', () => {
      expect(issuesOf(request([constraint('c1', 'pollo')], { limit: 50 }))).toEqual([
        expect.objectContaining({ field: 'limit' }),
      ]);
    });

    it('rejects the metadata of a golden-set request, which is not part of a search', () => {
      const raw = request([constraint('c1', 'pollo')], { id: 'A01', text: 'comidas con pollo', origin: 'x' });

      expect(issuesOf(raw)).toEqual([expect.objectContaining({ field: 'id, text, origin' })]);
    });

    it('rejects an unknown type, polarity or slot naming the field', () => {
      const fields = [
        issuesOf(request([constraint('c1', 'pollo', { type: 'regex' })])),
        issuesOf(request([constraint('c1', 'pollo', { polarity: 'maybe' })])),
        issuesOf(request([constraint('c1', 'pollo', { slot: 'breakfast' })])),
      ].map((issues) => issues.map((issue) => issue.field));

      expect(fields).toEqual([['type'], ['polarity'], ['slot']]);
    });

    it.each([null, 'pollo', 42, [], undefined])('rejects %j, which is not a structure', (raw) => {
      expect(issuesOf(raw)).toHaveLength(1);
    });
  });

  // GHSA-mrhx-c7xc-m3w5: zod reports one issue per failing element of an unbounded array, so a huge one exhausts the
  // memory. A bounded array is rejected by its size before any element is checked.
  describe('oversized groups', () => {
    const huge = Array.from({ length: 10_000 }, () => 0);

    it.each(['sameDish', 'anyOf'])('rejects a huge %s list with one issue naming it', (field) => {
      expect(issuesOf(request([constraint('c1', 'pollo')], { [field]: huge }))).toEqual([
        expect.objectContaining({ field }),
      ]);
    });

    it.each(['sameDish', 'anyOf'])('rejects a huge %s group with one issue naming it', (field) => {
      expect(issuesOf(request([constraint('c1', 'pollo')], { [field]: [huge] }))).toEqual([
        expect.objectContaining({ field }),
      ]);
    });
  });

  describe('rules across constraints and groups', () => {
    it('rejects a well-formed structure that breaks a rule, naming the field', () => {
      const raw = request([constraint('c1', 'pollo'), constraint('c1', 'cerdo')]);

      expect(issuesOf(raw)).toEqual([expect.objectContaining({ constraint: 'c1', field: 'id' })]);
    });

    it('reports every shape problem at once and leaves the rules for a well-formed shape', () => {
      const raw = request([constraint('c1', '   '), constraint('c2', 'b', { sql: 1 })], { sameDish: [['c1', 'c9']] });

      expect(issuesOf(raw).map((issue) => issue.field)).toEqual(['term', 'sql']);
    });
  });
});
