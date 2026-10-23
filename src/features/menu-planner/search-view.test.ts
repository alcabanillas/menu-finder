import { describe, expect, it } from 'vitest';
import type { SearchRequestDto } from '@/application/dto/search-request';
import type { DailyLimitedSearchError, SearchResultDto } from '@/application/dto/search-result';
import {
  describeChip,
  IDLE_SEARCH,
  summarize,
  toChips,
  evidenceMarks,
  toEvidenceLines,
  toSearchState,
  type EvidenceLine,
} from '@/features/menu-planner/search-view';
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

  it('names the day, the meal and the dish of a unit covered by a literal dish', () => {
    const lines = toEvidenceLines(chips, [
      { constraints: ['c3'], dish: { day: 'tuesday', meal: 'lunch', position: 1, name: 'Garbanzos con espinacas' }, match: 'literal' },
      { constraints: ['c2'], dish: null, match: 'none' },
      { constraints: ['c4'], dish: null, match: 'none' },
    ]);

    expect(lines[0]).toEqual({
      kind: 'constraint',
      terms: chips[0].members,
      state: 'met',
      detail: 'Martes, comida · Garbanzos con espinacas',
      dish: { day: 'tuesday', meal: 'lunch', name: 'Garbanzos con espinacas' },
    });
  });

  it('says "no aparece en la semana" with a check for a week-wide exclusion', () => {
    const lines = toEvidenceLines(chips, [
      { constraints: ['c3'], dish: null, match: 'none' },
      { constraints: ['c2'], dish: null, match: 'none' },
      { constraints: ['c4'], dish: null, match: 'none' },
    ]);

    expect(lines[1]).toEqual({ kind: 'constraint', terms: chips[1].members, state: 'met', detail: 'no aparece en la semana', dish: null });
  });

  it('says "ningún plato" with a cross for a soft constraint no dish covers', () => {
    const lines = toEvidenceLines(chips, [
      { constraints: ['c3'], dish: null, match: 'none' },
      { constraints: ['c2'], dish: null, match: 'none' },
      { constraints: ['c4'], dish: null, match: 'none' },
    ]);

    expect(lines[0]).toEqual({ kind: 'constraint', terms: chips[0].members, state: 'unmet', detail: 'ningún plato', dish: null });
    expect(lines[2]).toEqual({ kind: 'constraint', terms: chips[2].members, state: 'unmet', detail: 'ningún plato', dish: null });
  });

  it('says "parecido: " before the day, the meal and the dish of a unit covered by a similar dish', () => {
    const lines = toEvidenceLines(chips, [
      { constraints: ['c3'], dish: { day: 'thursday', meal: 'dinner', position: 1, name: 'Merluza en papillote' }, match: 'similar' },
      { constraints: ['c2'], dish: null, match: 'none' },
      { constraints: ['c4'], dish: null, match: 'none' },
    ]);

    expect(lines[0]).toEqual({
      kind: 'constraint',
      terms: chips[0].members,
      state: 'similar',
      detail: 'parecido: Jueves, cena · Merluza en papillote',
      dish: { day: 'thursday', meal: 'dinner', name: 'Merluza en papillote' },
    });
  });

  it('keeps the kind of its unit, so the card can separate the terms of a group like the chip does', () => {
    const group = toChips(structure([ARROZ, MARISCO], { sameDish: [['c1', 'c2']] }), [{ kind: 'sameDish', constraints: ['c1', 'c2'] }]);

    expect(toEvidenceLines(group, [{ constraints: ['c1', 'c2'], dish: null, match: 'none' }])[0].kind).toBe('sameDish');
  });

  it('labels the dinner of a weekend day', () => {
    const lines = toEvidenceLines(chips, [
      { constraints: ['c3'], dish: { day: 'sunday', meal: 'dinner', position: 1, name: 'Crema' }, match: 'literal' },
      { constraints: ['c2'], dish: null, match: 'none' },
      { constraints: ['c4'], dish: null, match: 'none' },
    ]);

    expect(lines[0].detail).toBe('Domingo, cena · Crema');
  });
});

describe('summarize', () => {
  function lines(...states: EvidenceLine['state'][]): EvidenceLine[] {
    return states.map((state) => ({ kind: 'constraint', terms: [], state, detail: '', dish: null }));
  }

  it('says every unit is met, counting a similar dish', () => {
    expect(summarize(lines('met', 'similar', 'met'))).toBe('Cumple las 3 cosas que pides, una con un plato parecido.');
  });

  it('says how many units are met when some are not', () => {
    expect(summarize(lines('met', 'unmet', 'met'))).toBe('Cumple 2 de las 3 cosas que pides.');
  });

  it('counts the similar dishes in words', () => {
    expect(summarize(lines('similar', 'similar', 'met'))).toBe('Cumple las 3 cosas que pides, dos con platos parecidos.');
  });

  it('writes in digits more than ten similar dishes', () => {
    expect(summarize(lines(...Array<EvidenceLine['state']>(11).fill('similar')))).toBe(
      'Cumple las 11 cosas que pides, 11 con platos parecidos.',
    );
  });

  it('says "Cumple lo que pides." for one unit met', () => {
    expect(summarize(lines('met'))).toBe('Cumple lo que pides.');
  });

  it('holds only fixed text and the counts, never a term or a dish', () => {
    const line: EvidenceLine = { kind: 'constraint', terms: [member(POLLO)], state: 'similar', detail: 'parecido: Lunes, comida · Pavo', dish: { day: 'monday', meal: 'lunch', name: 'Pavo' } };

    expect(summarize([line, { ...line, state: 'unmet' }])).toBe('Cumple 1 de las 2 cosas que pides, una con un plato parecido.');
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

  const REJECTED = 'Eso no parece una petición de menús. Prueba a decir qué te apetece comer.';
  const NOT_UNDERSTOOD = 'No he sabido entender la petición. Prueba a escribirla de otra forma.';
  const OUT_OF_CATALOG = 'Los menús solo tienen comidas y cenas: no hay postres, desayunos ni bebidas.';

  // Spec menu-planner, "Search messages": the message of each outcome and the group of its panel (MF-79 design D1).
  it.each<[DailyLimitedSearchError, string, string]>([
    [{ kind: 'request-too-short' }, 'Escribe qué te apetece.', 'request'],
    [{ kind: 'request-too-long', max: 300 }, 'La petición es demasiado larga: como mucho 300 caracteres.', 'request'],
    [{ kind: 'rejected', category: 'gibberish' }, REJECTED, 'request'],
    [{ kind: 'rejected', category: 'off-topic' }, REJECTED, 'request'],
    [{ kind: 'rejected', category: 'instruction' }, REJECTED, 'request'],
    [{ kind: 'rejected', category: 'not-a-search' }, REJECTED, 'request'],
    [{ kind: 'rejected', category: 'out-of-catalog' }, OUT_OF_CATALOG, 'catalog'],
    [{ kind: 'invalid-answer', issues: [] }, NOT_UNDERSTOOD, 'request'],
    [{ kind: 'nothing-to-search' }, NOT_UNDERSTOOD, 'request'],
    [{ kind: 'llm-limit-reached' }, 'Hoy ya no se pueden hacer más búsquedas. Vuelve a intentarlo mañana.', 'limit'],
    [{ kind: 'decomposer-failed', reason: 'quota' }, SYSTEM_FAILURE, 'failure'],
    [{ kind: 'embedding-failed', reason: 'quota' }, SYSTEM_FAILURE, 'failure'],
    [{ kind: 'search-failed', reason: 'down' }, SYSTEM_FAILURE, 'failure'],
    [{ kind: 'index-not-loaded', message: 'run embed' }, SYSTEM_FAILURE, 'failure'],
    [{ kind: 'invalid-request', issues: [] }, SYSTEM_FAILURE, 'failure'],
  ])('turns %j into a failed state with its kind, message and group, and the request as sent', (error, message, group) => {
    expect(toSearchState(err(error), 3, '  garbanzos ')).toEqual({
      status: 'failed',
      kind: error.kind,
      message,
      group,
      request: '  garbanzos ',
      attempt: 3,
    });
  });
  it('turns a ranking into chips and cards, in ranking order', () => {
    const state = toSearchState(ok({ structure: structure([POLLO]), result: resultWith([12, 3]) }), 1, 'pollo');

    expect(state).toMatchObject({ status: 'ranking', attempt: 1 });
    if (state.status !== 'ranking') throw new Error('expected a ranking');
    expect(state.chips).toHaveLength(1);
    expect(state.cards.map(({ rank, menu }) => [rank, menu])).toEqual([
      [1, 12],
      [2, 3],
    ]);
    expect(state.cards[0].lines).toEqual([
      { kind: 'constraint', terms: state.chips[0].members, state: 'unmet', detail: 'ningún plato', dish: null },
    ]);
    expect(state.cards[0].summary).toBe('Cumple 0 de las 1 cosas que pides.');
    expect(state.onlyExclusions).toBe(false);
  });

  it('marks a request with only week-wide exclusions, and gives its cards no rank and no summary', () => {
    const cerdo = { id: 'c3', type: 'exclusion', term: 'cerdo', polarity: 'exclude', hard: false } as const;

    const state = toSearchState(ok({ structure: structure([cerdo]), result: resultWith([4, 9]) }), 1, 'pollo');

    expect(state).toMatchObject({ status: 'ranking', onlyExclusions: true });
    expect(state.status === 'ranking' && state.cards.map(({ rank, summary }) => [rank, summary])).toEqual([
      [null, null],
      [null, null],
    ]);
  });

  it('does not mark a request with an exclusion and another constraint', () => {
    const chips = structure([POLLO, { ...MARISCO, id: 'c2' }]);
    const result: SearchResultDto = {
      ...resultWith([12]),
      units: [
        { kind: 'constraint', constraints: ['c3'] },
        { kind: 'constraint', constraints: ['c2'] },
      ],
      menus: [{ menu: 12, score: 1, evidence: [{ constraints: ['c3'], dish: null, match: 'none' }, { constraints: ['c2'], dish: null, match: 'none' }] }],
    };

    const state = toSearchState(ok({ structure: chips, result }), 1, 'pollo');

    expect(state).toMatchObject({ status: 'ranking', onlyExclusions: false });
    expect(state.status === 'ranking' && state.cards[0].summary).toBe('Cumple 1 de las 2 cosas que pides.');
  });

  it.each<[string, SearchResultDto]>([
    ['a unit names an id the structure does not have', { ...resultWith([12]), units: [{ kind: 'constraint', constraints: ['c9'] }] }],
    ['a menu has fewer evidence items than units', { ...resultWith([12]), menus: [{ menu: 12, score: 1, evidence: [] }] }],
    [
      'a menu has more evidence items than units',
      {
        ...resultWith([12]),
        menus: [{ menu: 12, score: 1, evidence: [{ constraints: ['c3'], dish: null, match: 'none' }, { constraints: ['c3'], dish: null, match: 'none' }] }],
      },
    ],
  ])('gives the failure of the system when %s, instead of throwing', (_case, result) => {
    expect(toSearchState(ok({ structure: structure([POLLO]), result }), 4, 'pollo')).toEqual({
      status: 'failed',
      kind: 'search-failed',
      message: SYSTEM_FAILURE,
      group: 'failure',
      request: 'pollo',
      attempt: 4,
    });
  });

  it('keeps the request exactly as it was sent, with its spaces and accents, for "Editar mi búsqueda"', () => {
    const request = '  cenas sin horno, con salmón  ';
    const state = toSearchState(ok({ structure: structure([POLLO]), result: resultWith([12]) }), 1, request);

    expect(state.status === 'ranking' && state.request).toBe(request);
  });

  it('turns an empty ranking into a ranking state with chips and no cards', () => {
    const state = toSearchState(ok({ structure: structure([POLLO]), result: resultWith([]) }), 2, 'pollo');

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
    menus: menus.map((menu) => ({ menu, score: 1, evidence: [{ constraints: ['c3'], dish: null, match: 'none' }] })),
    tiedWithFirst: menus.length,
    ranked: menus.map((menu) => ({ menu, score: 1 })),
    removedBy: [],
  };
}

describe('evidenceMarks', () => {
  const termOf = (term: string) => ({ term, polarity: 'include' as const, type: 'literal' as const, hard: false, slot: undefined });
  const line = (over: Partial<EvidenceLine>): EvidenceLine => ({ kind: 'constraint', terms: [member(POLLO)], state: 'met', detail: '', dish: null, ...over });

  it('marks the dish of a met line ✓ and the dish of a similar line ≈, with the term, by day, meal and name', () => {
    const marks = evidenceMarks([
      line({ terms: [member(POLLO)], dish: { day: 'monday', meal: 'lunch', name: 'Garbanzos con espinacas' } }),
      line({ terms: [member(LUBINA)], state: 'similar', dish: { day: 'thursday', meal: 'dinner', name: 'Merluza en papillote' } }),
    ]);

    expect(marks).toEqual([
      { day: 'monday', meal: 'lunch', name: 'Garbanzos con espinacas', state: 'met', label: POLLO.term },
      { day: 'thursday', meal: 'dinner', name: 'Merluza en papillote', state: 'similar', label: LUBINA.term },
    ]);
  });

  it('joins the terms of a group with "y" for the same dish and "o" for any of', () => {
    const dish = { day: 'monday' as const, meal: 'lunch' as const, name: 'Arroz' };

    const [same] = evidenceMarks([line({ kind: 'sameDish', terms: [termOf('arroz'), termOf('verduras')], dish })]);
    const [any] = evidenceMarks([line({ kind: 'anyOf', terms: [termOf('lubina'), termOf('dorada')], dish })]);

    expect(same.label).toBe('arroz y verduras');
    expect(any.label).toBe('lubina o dorada');
  });

  it('marks nothing for a line with no dish', () => {
    expect(evidenceMarks([line({ state: 'unmet' }), line({ state: 'met', detail: 'no aparece en la semana' })])).toEqual([]);
  });
});
