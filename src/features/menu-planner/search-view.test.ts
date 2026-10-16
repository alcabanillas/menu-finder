import { describe, expect, it } from 'vitest';
import type { SearchRequestDto } from '@/application/dto/search-request';
import type { DailyLimitedSearchError, SearchResultDto } from '@/application/dto/search-result';
import { describeChip, IDLE_SEARCH, toChips, toEvidenceLines, toSearchState } from '@/features/menu-planner/search-view';
import { err, ok } from '@/shared/result';

type Structure = Required<SearchRequestDto>;

const ARROZ = { id: 'c1', type: 'literal', term: 'arroz', polarity: 'include', hard: false } as const;
const MARISCO = { id: 'c2', type: 'exclusion', term: 'marisco', polarity: 'exclude', hard: true, slot: 'dinner' } as const;
const POLLO = { id: 'c3', type: 'literal', term: 'pollo', polarity: 'include', hard: false } as const;
const LUBINA = { id: 'c4', type: 'literal', term: 'lubina', polarity: 'include', hard: false } as const;
const DORADA = { id: 'c5', type: 'literal', term: 'dorada', polarity: 'include', hard: false } as const;

function structure(constraints: Structure['constraints'], groups: Partial<Structure> = {}): Structure {
  return { constraints, sameDish: [], anyOf: [], ...groups };
}

describe('toChips', () => {
  it('gives one chip for a constraint in no group, with the fields of its member', () => {
    const chips = toChips(structure([POLLO]), [{ kind: 'constraint', constraints: ['c3'] }]);

    expect(chips).toEqual([
      { kind: 'constraint', members: [{ term: 'pollo', polarity: 'include', type: 'literal', hard: false, slot: undefined }] },
    ]);
  });

  it('keeps the units in order: a sameDish group first, then the constraint apart', () => {
    const chips = toChips(structure([ARROZ, MARISCO, POLLO], { sameDish: [['c1', 'c2']] }), [
      { kind: 'sameDish', constraints: ['c1', 'c2'] },
      { kind: 'constraint', constraints: ['c3'] },
    ]);

    expect(chips.map(({ kind, members }) => [kind, members.map(({ term }) => term)])).toEqual([
      ['sameDish', ['arroz', 'marisco']],
      ['constraint', ['pollo']],
    ]);
    expect(chips[0].members[1]).toEqual({ term: 'marisco', polarity: 'exclude', type: 'exclusion', hard: true, slot: 'dinner' });
  });

  it('gives an anyOf unit as one chip', () => {
    const chips = toChips(structure([LUBINA, DORADA], { anyOf: [['c4', 'c5']] }), [{ kind: 'anyOf', constraints: ['c4', 'c5'] }]);

    expect(chips).toHaveLength(1);
    expect(chips[0].kind).toBe('anyOf');
    expect(chips[0].members.map(({ term }) => term)).toEqual(['lubina', 'dorada']);
  });
});

describe('toEvidenceLines', () => {
  const chips = toChips(structure([POLLO, MARISCO, LUBINA]), [
    { kind: 'constraint', constraints: ['c3'] },
    { kind: 'constraint', constraints: ['c2'] },
    { kind: 'constraint', constraints: ['c4'] },
  ]);

  it('names the day, the meal and the dish of a unit covered by a dish', () => {
    const lines = toEvidenceLines(chips, [
      { constraints: ['c3'], dish: { day: 'tuesday', meal: 'lunch', position: 1, name: 'Garbanzos con espinacas' } },
      { constraints: ['c2'], dish: null },
      { constraints: ['c4'], dish: null },
    ]);

    expect(lines[0]).toEqual({ kind: 'constraint', terms: chips[0].members, found: true, detail: 'Martes, comida · Garbanzos con espinacas' });
  });

  it('says "no aparece en la semana" with a check for a week-wide exclusion', () => {
    const lines = toEvidenceLines(chips, [
      { constraints: ['c3'], dish: null },
      { constraints: ['c2'], dish: null },
      { constraints: ['c4'], dish: null },
    ]);

    expect(lines[1]).toEqual({ kind: 'constraint', terms: chips[1].members, found: true, detail: 'no aparece en la semana' });
  });

  it('says "ningún plato" with a cross for a soft constraint no dish covers', () => {
    const lines = toEvidenceLines(chips, [
      { constraints: ['c3'], dish: null },
      { constraints: ['c2'], dish: null },
      { constraints: ['c4'], dish: null },
    ]);

    expect(lines[0]).toEqual({ kind: 'constraint', terms: chips[0].members, found: false, detail: 'ningún plato' });
    expect(lines[2]).toEqual({ kind: 'constraint', terms: chips[2].members, found: false, detail: 'ningún plato' });
  });

  it('keeps the kind of its unit, so the card can separate the terms of a group like the chip does', () => {
    const group = toChips(structure([ARROZ, MARISCO], { sameDish: [['c1', 'c2']] }), [{ kind: 'sameDish', constraints: ['c1', 'c2'] }]);

    expect(toEvidenceLines(group, [{ constraints: ['c1', 'c2'], dish: null }])[0].kind).toBe('sameDish');
  });

  it('labels the dinner of a weekend day', () => {
    const lines = toEvidenceLines(chips, [
      { constraints: ['c3'], dish: { day: 'sunday', meal: 'dinner', position: 1, name: 'Crema' } },
      { constraints: ['c2'], dish: null },
      { constraints: ['c4'], dish: null },
    ]);

    expect(lines[0].detail).toBe('Domingo, cena · Crema');
  });
});

const SYSTEM_FAILURE = 'No se ha podido buscar. Inténtalo de nuevo.';

describe('describeChip', () => {
  it('reads a constraint in no group as its term and hardness', () => {
    expect(describeChip({ kind: 'constraint', members: [member(POLLO)] })).toBe('pollo, preferencia');
  });

  it('reads an exclusion with its meal', () => {
    expect(describeChip({ kind: 'constraint', members: [member(MARISCO)] })).toBe('excluido: marisco, obligatorio, en la cena');
  });

  it('reads an included attribute', () => {
    const attribute = { ...POLLO, type: 'attribute', term: 'sencillas' } as const;
    expect(describeChip({ kind: 'constraint', members: [member(attribute)] })).toBe('atributo: sencillas, preferencia');
  });

  it('joins the members of a sameDish group with "y" and of an anyOf group with "o"', () => {
    expect(describeChip({ kind: 'sameDish', members: [member(ARROZ), member({ ...MARISCO, hard: false, slot: undefined })] })).toBe(
      'En el mismo plato: arroz, preferencia y excluido: marisco, preferencia',
    );
    expect(describeChip({ kind: 'anyOf', members: [member(LUBINA), member(DORADA)] })).toBe(
      'Una de: lubina, preferencia o dorada, preferencia',
    );
  });
});

describe('toSearchState', () => {
  it('starts idle, with no answer yet', () => {
    expect(IDLE_SEARCH).toEqual({ status: 'idle', attempt: 0 });
  });

  it.each<[DailyLimitedSearchError, string]>([
    [{ kind: 'request-too-short' }, 'Escribe qué te apetece.'],
    [{ kind: 'request-too-long', max: 300 }, 'La petición es demasiado larga: como mucho 300 caracteres.'],
    [{ kind: 'rejected', category: 'gibberish' }, 'Eso no parece una petición de menús. Prueba a decir qué te apetece comer.'],
    [{ kind: 'invalid-answer', issues: [] }, 'No he sabido entender la petición. Prueba a escribirla de otra forma.'],
    [{ kind: 'nothing-to-search' }, 'No he sabido entender la petición. Prueba a escribirla de otra forma.'],
    [{ kind: 'llm-limit-reached' }, 'Hoy ya no se pueden hacer más búsquedas. Vuelve a intentarlo mañana.'],
    [{ kind: 'decomposer-failed', reason: 'quota' }, SYSTEM_FAILURE],
    [{ kind: 'embedding-failed', reason: 'quota' }, SYSTEM_FAILURE],
    [{ kind: 'search-failed', reason: 'down' }, SYSTEM_FAILURE],
    [{ kind: 'index-not-loaded', message: 'run embed' }, SYSTEM_FAILURE],
    [{ kind: 'invalid-request', issues: [] }, SYSTEM_FAILURE],
  ])('turns %j into a failed state with its own kind and message', (error, message) => {
    expect(toSearchState(err(error), 3)).toEqual({ status: 'failed', kind: error.kind, message, attempt: 3 });
  });

  it('turns a ranking into chips and cards, in ranking order', () => {
    const state = toSearchState(ok({ structure: structure([POLLO]), result: resultWith([12, 3]) }), 1);

    expect(state).toMatchObject({ status: 'ranking', attempt: 1 });
    if (state.status !== 'ranking') throw new Error('expected a ranking');
    expect(state.chips).toHaveLength(1);
    expect(state.cards.map(({ rank, menu }) => [rank, menu])).toEqual([
      [1, 12],
      [2, 3],
    ]);
    expect(state.cards[0].lines).toEqual([
      { kind: 'constraint', terms: state.chips[0].members, found: false, detail: 'ningún plato' },
    ]);
  });

  it.each<[string, SearchResultDto]>([
    ['a unit names an id the structure does not have', { ...resultWith([12]), units: [{ kind: 'constraint', constraints: ['c9'] }] }],
    ['a menu has fewer evidence items than units', { ...resultWith([12]), menus: [{ menu: 12, score: 1, evidence: [] }] }],
    [
      'a menu has more evidence items than units',
      {
        ...resultWith([12]),
        menus: [{ menu: 12, score: 1, evidence: [{ constraints: ['c3'], dish: null }, { constraints: ['c3'], dish: null }] }],
      },
    ],
  ])('gives the failure of the system when %s, instead of throwing', (_case, result) => {
    expect(toSearchState(ok({ structure: structure([POLLO]), result }), 4)).toEqual({
      status: 'failed',
      kind: 'search-failed',
      message: SYSTEM_FAILURE,
      attempt: 4,
    });
  });

  it('turns an empty ranking into a ranking state with chips and no cards', () => {
    const state = toSearchState(ok({ structure: structure([POLLO]), result: resultWith([]) }), 2);

    expect(state).toMatchObject({ status: 'ranking', cards: [] });
    expect(state.status === 'ranking' && state.chips).toHaveLength(1);
  });
});

function member({ term, polarity, type, hard, slot }: Structure['constraints'][number]) {
  return { term, polarity, type, hard, slot };
}

function resultWith(menus: number[]): SearchResultDto {
  return {
    strategy: 'hybrid',
    units: [{ kind: 'constraint', constraints: ['c3'] }],
    menus: menus.map((menu) => ({ menu, score: 1, evidence: [{ constraints: ['c3'], dish: null }] })),
    tiedWithFirst: menus.length,
    ranked: menus.map((menu) => ({ menu, score: 1 })),
    removedBy: [],
  };
}
