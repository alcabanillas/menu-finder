import { describe, expect, it } from 'vitest';
import type { MealType } from '@/domain/menu/weekly-menu';
import { holdsLiterally, toUnits, type ScoredDish } from '@/domain/search/constraint-unit';
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

function dish(literal: Record<string, boolean>, scores: Record<string, number> = {}, meal: MealType = 'lunch'): ScoredDish {
  return { day: 'monday', meal, position: 1, name: 'Plato', scores, literal };
}

function holds(req: SearchRequest, scored: ScoredDish): boolean {
  return holdsLiterally(toUnits(req)[0], scored, 'semantic');
}

describe('holdsLiterally', () => {
  it('holds an ungrouped include constraint whose term the dish has word for word', () => {
    expect(holds(request([include('garbanzos')]), dish({ garbanzos: true }, { garbanzos: 0.8 }))).toBe(true);
  });

  it('does not hold an ungrouped include constraint whose term the dish only resembles', () => {
    expect(holds(request([include('garbanzos')]), dish({ garbanzos: false }, { garbanzos: 0.9 }))).toBe(false);
  });

  it('does not hold a constraint whose literal dish is in another slot', () => {
    const req = request([include('pescado', { slot: 'dinner' })]);

    expect(holds(req, dish({ pescado: true }, { pescado: 1 }, 'lunch'))).toBe(false);
  });

  it('holds a sameDish group when the dish has every include member word for word', () => {
    const req = request([include('arroz'), include('pollo')], { sameDish: [['arroz', 'pollo']] });

    expect(holds(req, dish({ arroz: true, pollo: true }))).toBe(true);
    expect(holds(req, dish({ arroz: true, pollo: false }, { pollo: 0.9 }))).toBe(false);
  });

  it('does not hold a sameDish group whose dish matches its exclusion with the strategy of the search', () => {
    const req = request([include('arroz'), exclude('marisco')], { sameDish: [['arroz', 'marisco']] });

    expect(holds(req, dish({ arroz: true, marisco: false }, { arroz: 1, marisco: 0.8 }))).toBe(false);
    expect(holds(req, dish({ arroz: true, marisco: false }, { arroz: 1, marisco: 0.2 }))).toBe(true);
  });

  it('holds an anyOf group when the dish has one include member word for word', () => {
    const req = request([include('garbanzos'), include('lentejas')], { anyOf: [['garbanzos', 'lentejas']] });

    expect(holds(req, dish({ garbanzos: false, lentejas: true }))).toBe(true);
    expect(holds(req, dish({ garbanzos: false, lentejas: false }))).toBe(false);
  });

  it('never holds a unit with no include member', () => {
    const req = request([exclude('cerdo'), exclude('ternera')], { anyOf: [['cerdo', 'ternera']] });

    expect(holds(req, dish({ cerdo: false, ternera: false }))).toBe(false);
  });
});
