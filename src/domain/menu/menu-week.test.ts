import { describe, expect, it } from 'vitest';
import { menuWeek } from '@/domain/menu/menu-week';
import type { MenuDish, WeeklyMenu } from '@/domain/menu/weekly-menu';
import type { Recipe } from '@/domain/recipe/recipe';

const dish = (position: number, name: string, recipeFile: string | null): MenuDish => ({
  position,
  name,
  hasRecipeMark: recipeFile !== null,
  recipeFile,
});

const lentejas: Recipe = {
  file: 'Lentejas',
  sourceMenu: 3,
  title: 'Lentejas estofadas',
  times: { total: 45, preparation: 10, cooking: 35, resting: null },
  ingredients: [{ name: 'Lentejas', householdMeasure: null, quantity: 240, unit: 'g', optional: false }],
  preparation: ['Sofreír.', 'Cocer.'],
};

const MENU: WeeklyMenu = {
  number: 3,
  meals: [
    { day: 'monday', type: 'lunch', dishes: [dish(1, 'Lentejas estofadas', 'Lentejas'), dish(2, 'Fruta', null)] },
    { day: 'monday', type: 'dinner', dishes: [dish(1, 'Crema', 'Crema')] },
    { day: 'sunday', type: 'lunch', dishes: [] },
    { day: 'sunday', type: 'dinner', dishes: [] },
  ],
};

const week = () => menuWeek(MENU, [lentejas], '2026-10-05', '2026-10-07');

describe('menuWeek', () => {
  it('keeps the menu number, its Monday and today', () => {
    expect(week()).toMatchObject({ menuNumber: 3, startsOn: '2026-10-05', today: '2026-10-07' });
  });

  it('gives the seven days in order, each with its date', () => {
    expect(week().days.map(({ day, date }) => [day, date])).toEqual([
      ['monday', '2026-10-05'],
      ['tuesday', '2026-10-06'],
      ['wednesday', '2026-10-07'],
      ['thursday', '2026-10-08'],
      ['friday', '2026-10-09'],
      ['saturday', '2026-10-10'],
      ['sunday', '2026-10-11'],
    ]);
  });

  it('puts the lunch and dinner dishes in the order of the menu', () => {
    const monday = week().days[0];

    expect(monday.meals.lunch.map(({ name }) => name)).toEqual(['Lentejas estofadas', 'Fruta']);
    expect(monday.meals.dinner.map(({ name }) => name)).toEqual(['Crema']);
  });

  it('gives a dish its recipe when its file was read, without the file and source menu', () => {
    expect(week().days[0].meals.lunch[0].recipe).toEqual({
      title: 'Lentejas estofadas',
      times: lentejas.times,
      ingredients: lentejas.ingredients,
      preparation: lentejas.preparation,
    });
  });

  it('gives no recipe to a dish without recipe file, or whose file was not read', () => {
    const monday = week().days[0];

    expect(monday.meals.lunch[1].recipe).toBeNull();
    expect(monday.meals.dinner[0].recipe).toBeNull();
  });

  it('leaves both meals empty on a day with no dishes, listed in the menu or not', () => {
    const { days } = week();

    expect(days[6].meals).toEqual({ lunch: [], dinner: [] });
    expect(days[2].meals).toEqual({ lunch: [], dinner: [] });
  });
});
