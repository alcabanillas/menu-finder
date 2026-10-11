import { describe, expect, it } from 'vitest';
import { termsNotInRequest } from '@/domain/search/request-terms';

describe('termsNotInRequest', () => {
  it('finds nothing when every term is in the text', () => {
    const constraints = [
      { id: 'c1', term: 'rápidas' },
      { id: 'c2', term: 'cerdo' },
    ];

    expect(termsNotInRequest('cenas rápidas sin cerdo', constraints)).toEqual([]);
  });

  it('names the constraint whose term is not in the text', () => {
    const constraints = [
      { id: 'c1', term: 'pollo' },
      { id: 'c2', term: 'salmón' },
    ];

    expect(termsNotInRequest('algo con pollo', constraints)).toEqual(['c2']);
  });

  it('compares in lowercase', () => {
    expect(termsNotInRequest('Pollo con arroz', [{ id: 'c1', term: 'pollo' }])).toEqual([]);
    expect(termsNotInRequest('pollo con arroz', [{ id: 'c1', term: 'Pollo' }])).toEqual([]);
  });

  it('ignores the spaces around the text and the term', () => {
    expect(termsNotInRequest('  de cuchara  ', [{ id: 'c1', term: ' de cuchara ' }])).toEqual([]);
  });

  it('does not accept another form of the word', () => {
    expect(termsNotInRequest('cenas rápidas', [{ id: 'c1', term: 'rápido' }])).toEqual(['c1']);
  });
});
