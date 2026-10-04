import { describe, expect, it } from 'vitest';
import type { MealType } from '@/domain/menu/weekly-menu';
import { toUnits, type ScoredDish, type ScoredMenu } from '@/domain/search/constraint-unit';
import { filterByHardUnits, satisfiesUnit } from '@/domain/search/hard-constraints';
import type { Constraint, SearchRequest } from '@/domain/search/search-request';

function include(id: string, overrides: Partial<Constraint> = {}): Constraint {
  return { id, type: 'literal', term: id, polarity: 'include', hard: true, ...overrides };
}

function exclude(id: string, overrides: Partial<Constraint> = {}): Constraint {
  return include(id, { type: 'exclusion', polarity: 'exclude', ...overrides });
}

function request(constraints: Constraint[], groups: Partial<SearchRequest> = {}): SearchRequest {
  return { constraints, sameDish: [], anyOf: [], ...groups };
}

function dish(scores: Record<string, number>, meal: MealType = 'lunch'): ScoredDish {
  return { day: 'monday', meal, position: 1, name: 'dish', scores };
}

function menus(count: number, dishesOf: (menu: number) => ScoredDish[]): ScoredMenu[] {
  return Array.from({ length: count }, (_, index) => ({ menu: index + 1, dishes: dishesOf(index + 1) }));
}

function satisfies(req: SearchRequest, dishes: ScoredDish[], strategy: 'lexical' | 'hybrid' = 'lexical') {
  return satisfiesUnit(toUnits(req)[0], dishes, strategy);
}

describe('satisfiesUnit', () => {
  it('is satisfied by an include constraint when a dish matches its term', () => {
    expect(satisfies(request([include('pollo')]), [dish({ pollo: 0 }), dish({ pollo: 1 })])).toBe(true);
    expect(satisfies(request([include('pollo')]), [dish({ pollo: 0 })])).toBe(false);
  });

  it('is satisfied by an include constraint only with a dish of its slot', () => {
    expect(satisfies(request([include('pollo', { slot: 'dinner' })]), [dish({ pollo: 1 }, 'lunch')])).toBe(false);
  });

  it('is satisfied by a week-wide exclusion when no dish matches its term', () => {
    expect(satisfies(request([exclude('cerdo')]), [dish({ cerdo: 0 })])).toBe(true);
    expect(satisfies(request([exclude('cerdo')]), [dish({ cerdo: 0 }), dish({ cerdo: 1 })])).toBe(false);
  });

  it('is satisfied by a sameDish group when one dish matches every include member and no exclude member', () => {
    const req = request([include('arroz'), exclude('pescado')], { sameDish: [['arroz', 'pescado']] });

    expect(satisfies(req, [dish({ arroz: 1, pescado: 1 }), dish({ arroz: 1, pescado: 0 })])).toBe(true);
    expect(satisfies(req, [dish({ arroz: 1, pescado: 1 }), dish({ arroz: 0, pescado: 0 })])).toBe(false);
  });

  it('uses the same 0.75 threshold for a hybrid exclusion alone and in a sameDish group', () => {
    const alone = request([exclude('pescado')]);
    const inGroup = request([include('arroz'), exclude('pescado')], { sameDish: [['arroz', 'pescado']] });

    expect(satisfies(alone, [dish({ pescado: 0.3 })], 'hybrid')).toBe(true);
    expect(satisfies(inGroup, [dish({ arroz: 1, pescado: 0.3 })], 'hybrid')).toBe(true);
    expect(satisfies(inGroup, [dish({ arroz: 1, pescado: 0.75 })], 'hybrid')).toBe(false);
  });

  it('is satisfied by a sameDish group only with a dish in the slot of every member, an exclusion included', () => {
    const req = request([include('arroz'), exclude('carne', { slot: 'dinner' })], { sameDish: [['arroz', 'carne']] });

    expect(satisfies(req, [dish({ arroz: 1, carne: 0 }, 'dinner')])).toBe(true);
    expect(satisfies(req, [dish({ arroz: 1, carne: 0 }, 'lunch')])).toBe(false);
  });

  it('is satisfied by a week-wide exclusion with a slot when only dishes of another slot match its term', () => {
    expect(satisfies(request([exclude('cremas', { slot: 'lunch' })]), [dish({ cremas: 1 }, 'dinner')])).toBe(true);
  });

  it('is satisfied by an anyOf group when a dish matches the term of any member', () => {
    const req = request([include('garbanzos'), include('lentejas')], { anyOf: [['garbanzos', 'lentejas']] });

    expect(satisfies(req, [dish({ garbanzos: 0, lentejas: 1 })])).toBe(true);
    expect(satisfies(req, [dish({ garbanzos: 0, lentejas: 0 })])).toBe(false);
  });
});

describe('filterByHardUnits', () => {
  it('keeps the menus that satisfy a hard constraint and reports how many it removes', () => {
    const all = menus(36, (menu) => [dish({ pollo: menu <= 5 ? 1 : 0 })]);
    const req = request([include('pollo')]);

    const filter = filterByHardUnits(all, toUnits(req), 'lexical');

    expect(filter.kept.map(({ menu }) => menu)).toEqual([1, 2, 3, 4, 5]);
    expect(filter.removedBy).toEqual([{ constraints: ['pollo'], menusRemoved: 31 }]);
  });

  it('keeps no menu when none satisfies a hard constraint', () => {
    const filter = filterByHardUnits(menus(36, () => [dish({ pollo: 0 })]), toUnits(request([include('pollo')])), 'lexical');

    expect(filter).toEqual({ kept: [], removedBy: [{ constraints: ['pollo'], menusRemoved: 36 }] });
  });

  it('counts each hard constraint on its own and keeps only the menus that satisfy all of them', () => {
    const all = menus(36, (menu) => [dish({ pollo: menu > 20 ? 1 : 0, arroz: menu <= 25 ? 0 : 1 })]);
    const req = request([include('pollo'), include('arroz')]);

    const filter = filterByHardUnits(all, toUnits(req), 'lexical');

    expect(filter.removedBy).toEqual([
      { constraints: ['pollo'], menusRemoved: 20 },
      { constraints: ['arroz'], menusRemoved: 25 },
    ]);
    expect(filter.kept.map(({ menu }) => menu)).toEqual([26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36]);
  });

  it('treats a group as hard when any member is hard, and ignores soft units', () => {
    const req = request([include('arroz', { hard: false }), include('pollo'), include('brocoli', { hard: false })], {
      sameDish: [['arroz', 'pollo']],
    });
    const all = menus(2, (menu) => [dish({ arroz: 1, pollo: menu === 1 ? 1 : 0, brocoli: 0 })]);

    const filter = filterByHardUnits(all, toUnits(req), 'lexical');

    expect(filter).toEqual({ kept: [all[0]], removedBy: [{ constraints: ['arroz', 'pollo'], menusRemoved: 1 }] });
  });
});
