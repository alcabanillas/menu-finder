import { describe, expect, it } from 'vitest';
import type { MealType } from '@/domain/menu/weekly-menu';
import { toUnits, type ScoredDish } from '@/domain/search/constraint-unit';
import { scoreMenu } from '@/domain/search/score-menu';
import type { Constraint, SearchRequest } from '@/domain/search/search-request';
import type { Strategy } from '@/domain/search/term-score';

function include(id: string, overrides: Partial<Constraint> = {}): Constraint {
  return { id, type: 'literal', term: id, polarity: 'include', hard: false, ...overrides };
}

function exclude(id: string, overrides: Partial<Constraint> = {}): Constraint {
  return include(id, { type: 'exclusion', polarity: 'exclude', ...overrides });
}

function request(constraints: Constraint[], groups: Partial<SearchRequest> = {}): SearchRequest {
  return { constraints, sameDish: [], anyOf: [], ...groups };
}

function dish(
  name: string,
  scores: Record<string, number>,
  meal: MealType = 'lunch',
  position = 1,
  literal: Record<string, boolean> = {},
): ScoredDish {
  return { day: 'monday', meal, position, name, scores, literal };
}

function score(req: SearchRequest, dishes: ScoredDish[], strategy: Strategy = 'semantic') {
  return scoreMenu({ menu: 1, dishes }, toUnits(req), strategy);
}

describe('toUnits', () => {
  it('makes one unit of each group and of each ungrouped constraint, in the order of their first constraint', () => {
    const req = request([include('a'), include('b'), include('c'), include('d'), include('e')], {
      sameDish: [['b', 'd']],
      anyOf: [['c', 'e']],
    });

    const units = toUnits(req).map((unit) => [unit.kind, unit.members.map((member) => member.id)]);

    expect(units).toEqual([
      ['constraint', ['a']],
      ['sameDish', ['b', 'd']],
      ['anyOf', ['c', 'e']],
    ]);
  });
});

describe('scoreMenu', () => {
  it('scores 1 when each ungrouped constraint is covered by a different dish', () => {
    const req = request([include('pollo'), include('brocoli')]);
    const dishes = [dish('Pollo asado', { pollo: 1, brocoli: 0 }), dish('Brócoli', { pollo: 0, brocoli: 1 })];

    expect(score(req, dishes)).toMatchObject({ menu: 1, score: 1, units: [{ score: 1 }, { score: 1 }] });
  });

  it('scores 0 a sameDish group when no dish has every member', () => {
    const req = request([include('arroz'), include('pollo')], { sameDish: [['arroz', 'pollo']] });
    const dishes = [dish('Arroz con verduras', { arroz: 1, pollo: 0 }), dish('Pollo asado', { arroz: 0, pollo: 1 })];

    expect(score(req, dishes).score).toBe(0);
  });

  it('scores 0 a sameDish group whose only dish has the excluded term', () => {
    const req = request([include('arroz'), exclude('pescado')], { sameDish: [['arroz', 'pescado']] });

    expect(score(req, [dish('Arroz con merluza', { arroz: 1, pescado: 1 })]).score).toBe(0);
  });

  it('scores 1 an anyOf group when the menu has one of the alternatives', () => {
    const req = request([include('garbanzos'), include('lentejas')], { anyOf: [['garbanzos', 'lentejas']] });

    expect(score(req, [dish('Lentejas', { garbanzos: 0, lentejas: 1 })]).score).toBe(1);
  });

  it('leaves a week-wide exclusion out of the menu score', () => {
    const req = request([include('pollo'), exclude('cerdo')]);

    expect(score(req, [dish('Pollo dudoso', { pollo: 0.7, cerdo: 0 })]).score).toBeCloseTo(0.7);
  });

  it('gives a week-wide exclusion the unit score 1 with no evidence', () => {
    const req = request([include('pollo'), exclude('cerdo')]);

    expect(score(req, [dish('Pollo asado', { pollo: 1, cerdo: 0 })]).units[1]).toEqual({ score: 1, evidence: null, match: 'none' });
  });

  it('scores 1 a menu when every unit of the request is a week-wide exclusion', () => {
    const req = request([exclude('cerdo'), exclude('queso')]);

    expect(score(req, [dish('Merluza', { cerdo: 0, queso: 0 })]).score).toBe(1);
  });

  it('scores 0 a constraint whose only matching dish is in another slot', () => {
    const req = request([include('pescado', { slot: 'dinner' })]);

    expect(score(req, [dish('Merluza', { pescado: 1 }, 'lunch')]).score).toBe(0);
  });

  it('scores 0.5 a menu that covers one of two ungrouped constraints', () => {
    const req = request([include('pollo'), include('brocoli')]);

    expect(score(req, [dish('Pollo asado', { pollo: 1, brocoli: 0 })]).score).toBe(0.5);
  });

  it('gives as similar evidence the dish with the highest score for the unit, the first one on a tie', () => {
    const dishes = [
      dish('Arroz', { pollo: 0.2 }),
      dish('Pollo asado', { pollo: 0.9 }, 'lunch', 2),
      dish('Pollo al curry', { pollo: 0.9 }, 'dinner'),
    ];

    expect(score(request([include('pollo')]), dishes).units[0]).toMatchObject({ evidence: { name: 'Pollo asado' }, match: 'similar' });
  });

  it('gives as literal evidence the first dish with the term word for word, over a more similar one', () => {
    const dishes = [
      dish('Lentejas estofadas', { garbanzos: 0.9 }),
      dish('Garbanzos con espinacas', { garbanzos: 0.8 }, 'lunch', 2, { garbanzos: true }),
      dish('Potaje de garbanzos', { garbanzos: 0.7 }, 'dinner', 1, { garbanzos: true }),
    ];

    expect(score(request([include('garbanzos')]), dishes).units[0]).toMatchObject({
      evidence: { name: 'Garbanzos con espinacas' },
      match: 'literal',
    });
  });

  it('keeps the best score for the unit when the literal dish scores lower, so the ranking does not move', () => {
    const dishes = [
      dish('Lentejas estofadas', { garbanzos: 0.9 }),
      dish('Garbanzos con espinacas', { garbanzos: 0.8 }, 'lunch', 2, { garbanzos: true }),
    ];

    expect(score(request([include('garbanzos')]), dishes)).toMatchObject({ score: 0.9, units: [{ score: 0.9, match: 'literal' }] });
  });

  it('gives no evidence for a unit whose best dish does not reach the matching threshold', () => {
    const result = score(request([include('pollo')]), [dish('Merluza', { pollo: 0.15 })]);

    expect(result.units[0]).toEqual({ score: 0.15, evidence: null, match: 'none' });
  });

  it('compares the best score with the threshold at two decimals', () => {
    const result = score(request([include('pollo')]), [dish('Pavo', { pollo: 0.4999999999999999 })]);

    expect(result.units[0]).toMatchObject({ evidence: { name: 'Pavo' }, match: 'similar' });
  });

  it('gives literal evidence or none with the lexical strategy', () => {
    const literal = [dish('Salmón al horno', { salmon: 1 }, 'lunch', 1, { salmon: true })];

    expect(score(request([include('salmon')]), literal, 'lexical').units[0].match).toBe('literal');
    expect(score(request([include('salmon')]), [dish('Merluza', { salmon: 0 })], 'lexical').units[0].match).toBe('none');
  });

  it('gives no evidence for a week-wide exclusion', () => {
    expect(score(request([exclude('cerdo')]), [dish('Lomo', { cerdo: 1 })]).units[0]).toMatchObject({ evidence: null, match: 'none' });
  });

  it('gives no evidence for a unit whose best score is 0', () => {
    const dishes = [dish('Lentejas', { pollo: 0 }), dish('Merluza', { pollo: 0 }, 'dinner')];

    expect(score(request([include('pollo')]), dishes).units[0]).toEqual({ score: 0, evidence: null, match: 'none' });
  });

  it('scores 0 with no evidence a unit of a menu with no dish', () => {
    expect(score(request([include('pollo')]), []).units[0]).toEqual({ score: 0, evidence: null, match: 'none' });
  });
});
