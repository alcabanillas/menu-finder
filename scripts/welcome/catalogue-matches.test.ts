import { describe, expect, it } from 'vitest';
import { catalogueMatches, catalogueNames } from './catalogue-matches';

// Fictitious names only (AGENTS.md: never real data).
const MENUS = [
  { number: 1, meals: [{ day: 'monday', type: 'lunch', dishes: [{ name: 'Plato ficticio A' }, { name: '  Plato Ficticio B ' }] }] },
];
const RECIPES = [{ title: 'Receta ficticia C' }];

describe('catalogueNames', () => {
  it('collects the dish names of every meal and the recipe titles', () => {
    expect(catalogueNames(MENUS, RECIPES)).toEqual(new Set(['plato ficticio a', 'plato ficticio b', 'receta ficticia c']));
  });

  it('skips a meal whose dishes are not a list', () => {
    const menus = [{ number: 2, meals: [{ day: 'monday', type: 'lunch', dishes: '' }] }];
    expect(catalogueNames(menus, [])).toEqual(new Set());
  });
});

describe('catalogueMatches', () => {
  const names = catalogueNames(MENUS, RECIPES);

  it('names the samples equal to a catalogue name, ignoring case and outer spaces', () => {
    expect(catalogueMatches(['plato ficticio B', 'Receta ficticia C ', 'Plato inventado'], names)).toEqual([
      'plato ficticio B',
      'Receta ficticia C ',
    ]);
  });

  it('does not flag a sample that is only part of a catalogue name', () => {
    expect(catalogueMatches(['Plato ficticio'], names)).toEqual([]);
  });
});
