import { describe, expect, it } from 'vitest';
import { findRequestIssues, type Constraint, type SearchRequest } from '@/domain/search/search-request';

function constraint(id: string, overrides: Partial<Constraint> = {}): Constraint {
  return { id, type: 'literal', term: id, polarity: 'include', hard: false, ...overrides };
}

function request(constraints: Constraint[], groups: Partial<SearchRequest> = {}): SearchRequest {
  return { constraints, sameDish: [], anyOf: [], ...groups };
}

describe('findRequestIssues', () => {
  it('finds no issue in a valid request', () => {
    const valid = request([constraint('c1'), constraint('c2', { type: 'exclusion', polarity: 'exclude' })], {
      sameDish: [['c1', 'c2']],
    });

    expect(findRequestIssues(valid)).toEqual([]);
  });

  describe('ids', () => {
    it('rejects a repeated constraint id naming id', () => {
      expect(findRequestIssues(request([constraint('c1'), constraint('c1')]))).toEqual([
        expect.objectContaining({ constraint: 'c1', field: 'id' }),
      ]);
    });
  });

  describe('polarity', () => {
    it('rejects an exclusion with polarity include naming polarity', () => {
      const raw = request([constraint('c1', { type: 'exclusion', polarity: 'include' })]);

      expect(findRequestIssues(raw)).toEqual([expect.objectContaining({ constraint: 'c1', field: 'polarity' })]);
    });

    it('rejects an anyOf member with polarity exclude naming anyOf', () => {
      const raw = request([constraint('c1'), constraint('c2', { polarity: 'exclude' })], { anyOf: [['c1', 'c2']] });

      expect(findRequestIssues(raw)).toEqual([expect.objectContaining({ constraint: 'c2', field: 'anyOf' })]);
    });
  });

  describe('groups', () => {
    it('rejects a sameDish group that names an unknown constraint', () => {
      const raw = request([constraint('c1')], { sameDish: [['c1', 'c9']] });

      expect(findRequestIssues(raw)).toEqual([expect.objectContaining({ constraint: 'c9', field: 'sameDish' })]);
    });

    it('rejects an anyOf group that names an unknown constraint', () => {
      const raw = request([constraint('c1')], { anyOf: [['c1', 'c9']] });

      expect(findRequestIssues(raw)).toEqual([expect.objectContaining({ constraint: 'c9', field: 'anyOf' })]);
    });

    it('rejects a group with fewer than two constraints', () => {
      const raw = request([constraint('c1')], { sameDish: [['c1']] });

      expect(findRequestIssues(raw)).toEqual([expect.objectContaining({ field: 'sameDish' })]);
    });

    it('rejects a constraint in two sameDish groups', () => {
      const raw = request([constraint('c1'), constraint('c2'), constraint('c3')], {
        sameDish: [
          ['c1', 'c2'],
          ['c1', 'c3'],
        ],
      });

      expect(findRequestIssues(raw)).toEqual([expect.objectContaining({ constraint: 'c1', field: 'sameDish' })]);
    });

    it('rejects a constraint in a sameDish and an anyOf group', () => {
      const raw = request([constraint('c1'), constraint('c2'), constraint('c3')], {
        sameDish: [['c1', 'c2']],
        anyOf: [['c1', 'c3']],
      });

      expect(findRequestIssues(raw)).toEqual([expect.objectContaining({ constraint: 'c1', field: 'anyOf' })]);
    });
  });
});
