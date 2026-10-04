import { describe, expect, it } from 'vitest';
import type { MealType } from '@/domain/menu/weekly-menu';
import { toUnits, type ScoredDish } from '@/domain/search/constraint-unit';
import { scoreMenu } from '@/domain/search/score-menu';
import type { Constraint, SearchRequest } from '@/domain/search/search-request';

function include(id: string, overrides: Partial<Constraint> = {}): Constraint {
  return { id, type: 'literal', term: id, polarity: 'include', hard: false, ...overrides };
}

function exclude(id: string, overrides: Partial<Constraint> = {}): Constraint {
  return include(id, { type: 'exclusion', polarity: 'exclude', ...overrides });
}

function request(constraints: Constraint[], groups: Partial<SearchRequest> = {}): SearchRequest {
  return { constraints, sameDish: [], anyOf: [], ...groups };
}

function dish(name: string, scores: Record<string, number>, meal: MealType = 'lunch', position = 1): ScoredDish {
  return { day: 'monday', meal, position, name, scores };
}

function score(req: SearchRequest, dishes: ScoredDish[], strategy: 'lexical' | 'hybrid' = 'lexical') {
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

  it('scores a week-wide exclusion 1 / (1 + n), with n the dishes that match its term', () => {
    const dishes = [
      dish('Lomo', { cerdo: 1 }),
      dish('Chorizo', { cerdo: 1 }, 'lunch', 2),
      dish('Jamón', { cerdo: 1 }, 'dinner'),
      dish('Merluza', { cerdo: 0 }, 'dinner', 2),
    ];

    expect(score(request([exclude('cerdo')]), dishes).score).toBe(0.25);
  });

  it('counts n with the hybrid threshold under the hybrid strategy', () => {
    const dishes = [dish('Lomo', { cerdo: 0.75 }), dish('Pavo', { cerdo: 0.5 }, 'dinner')];

    expect(score(request([exclude('cerdo')]), dishes, 'hybrid').score).toBe(0.5);
  });

  it('counts n only among the dishes of the slot of the exclusion', () => {
    const dishes = [dish('Lomo', { cerdo: 1 }), dish('Jamón', { cerdo: 1 }, 'dinner')];

    expect(score(request([exclude('cerdo', { slot: 'dinner' })]), dishes).score).toBe(0.5);
  });

  it('scores 0 a constraint whose only matching dish is in another slot', () => {
    const req = request([include('pescado', { slot: 'dinner' })]);

    expect(score(req, [dish('Merluza', { pescado: 1 }, 'lunch')]).score).toBe(0);
  });

  it('scores 0.5 a menu that covers one of two ungrouped constraints', () => {
    const req = request([include('pollo'), include('brocoli')]);

    expect(score(req, [dish('Pollo asado', { pollo: 1, brocoli: 0 })]).score).toBe(0.5);
  });

  it('gives as evidence the dish with the highest score for the unit, the first one on a tie', () => {
    const dishes = [
      dish('Arroz', { pollo: 0.2 }),
      dish('Pollo asado', { pollo: 0.9 }, 'lunch', 2),
      dish('Pollo al curry', { pollo: 0.9 }, 'dinner'),
    ];

    expect(score(request([include('pollo')]), dishes).units[0].evidence?.name).toBe('Pollo asado');
  });

  it('gives no evidence for a week-wide exclusion', () => {
    expect(score(request([exclude('cerdo')]), [dish('Lomo', { cerdo: 1 })]).units[0].evidence).toBeNull();
  });

  it('scores 0 with no evidence a unit of a menu with no dish', () => {
    expect(score(request([include('pollo')]), []).units[0]).toEqual({ score: 0, evidence: null });
  });
});
