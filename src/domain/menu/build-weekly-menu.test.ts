import { describe, expect, it } from 'vitest';
import { buildWeeklyMenu } from '@/domain/menu/build-weekly-menu';
import type { SourceDish, SourceMenu } from '@/domain/menu/source-menu';

const marked = (name: string): SourceDish => ({ name, hasRecipeMark: true });
const unmarked = (name: string): SourceDish => ({ name, hasRecipeMark: false });
const FRUIT = unmarked('Una pieza de fruta (no zumo).');

const EMPTY_SOURCE: SourceMenu = { meals: [] };

describe('buildWeeklyMenu', () => {
  it('builds fourteen meals ordered by day and then lunch before dinner', () => {
    const { menu } = buildWeeklyMenu(3, EMPTY_SOURCE, []);

    expect(menu.number).toBe(3);
    expect(menu.meals.map((meal) => `${meal.day}/${meal.type}`)).toEqual([
      'monday/lunch', 'monday/dinner', 'tuesday/lunch', 'tuesday/dinner',
      'wednesday/lunch', 'wednesday/dinner', 'thursday/lunch', 'thursday/dinner',
      'friday/lunch', 'friday/dinner', 'saturday/lunch', 'saturday/dinner',
      'sunday/lunch', 'sunday/dinner',
    ]);
  });

  it('adds a meal the source omits with no dishes, such as an empty Sunday', () => {
    const source: SourceMenu = { meals: [{ day: 'monday', type: 'lunch', dishes: [marked('Lentejas estofadas')] }] };

    const { menu } = buildWeeklyMenu(1, source, []);

    const sunday = menu.meals.filter((meal) => meal.day === 'sunday');
    expect(sunday.map((meal) => meal.dishes)).toEqual([[], []]);
  });

  it('keeps source order as 1-based positions after dropping unmarked filler', () => {
    const source: SourceMenu = {
      meals: [{ day: 'tuesday', type: 'dinner', dishes: [marked('Lentejas estofadas'), FRUIT, unmarked('Pimientos asados')] }],
    };

    const { menu } = buildWeeklyMenu(1, source, ['Lentejas-estofadas']);

    const tuesdayDinner = menu.meals.find((meal) => meal.day === 'tuesday' && meal.type === 'dinner');
    expect(tuesdayDinner?.dishes).toEqual([
      { position: 1, name: 'Lentejas estofadas', hasRecipeMark: true, recipeFile: 'Lentejas-estofadas' },
      { position: 2, name: 'Pimientos asados', hasRecipeMark: false, recipeFile: null },
    ]);
  });

  it('keeps a marked dish even when its name looks like filler', () => {
    const source: SourceMenu = { meals: [{ day: 'monday', type: 'lunch', dishes: [marked('Una pieza de fruta')] }] };

    const { menu } = buildWeeklyMenu(1, source, []);

    expect(menu.meals[0].dishes.map((dish) => dish.name)).toEqual(['Una pieza de fruta']);
  });

  it('sets recipeFile only for resolved dishes and stores no score in the menu', () => {
    const source: SourceMenu = {
      meals: [{ day: 'monday', type: 'lunch', dishes: [marked('Merluza al horno'), marked('Pollo al curry con arroz')] }],
    };

    const { menu } = buildWeeklyMenu(1, source, ['Merluza-al-horno', 'Pollo-con-verduras']);

    expect(menu.meals[0].dishes).toEqual([
      { position: 1, name: 'Merluza al horno', hasRecipeMark: true, recipeFile: 'Merluza-al-horno' },
      { position: 2, name: 'Pollo al curry con arroz', hasRecipeMark: true, recipeFile: null },
    ]);
  });

  it("returns each kept dish's resolution with its day, meal and position", () => {
    const source: SourceMenu = {
      meals: [{ day: 'wednesday', type: 'dinner', dishes: [marked('Pollo al curry con arroz'), FRUIT, unmarked('Pimientos asados')] }],
    };

    const { dishes } = buildWeeklyMenu(1, source, ['Pollo-con-verduras']);

    expect(dishes).toEqual([
      {
        day: 'wednesday',
        type: 'dinner',
        position: 1,
        name: 'Pollo al curry con arroz',
        resolution: { status: 'unresolved', discarded: { recipe: 'Pollo-con-verduras', score: 0.5 } },
      },
      { day: 'wednesday', type: 'dinner', position: 2, name: 'Pimientos asados', resolution: { status: 'unmarked' } },
    ]);
  });

  it('joins the dishes of a meal the source lists more than once, in source order', () => {
    const source: SourceMenu = {
      meals: [
        { day: 'friday', type: 'lunch', dishes: [marked('Lentejas estofadas')] },
        { day: 'friday', type: 'lunch', dishes: [unmarked('Pimientos asados')] },
      ],
    };

    const { menu } = buildWeeklyMenu(1, source, []);

    const fridayLunch = menu.meals.find((meal) => meal.day === 'friday' && meal.type === 'lunch');
    expect(fridayLunch?.dishes.map((dish) => [dish.position, dish.name])).toEqual([
      [1, 'Lentejas estofadas'],
      [2, 'Pimientos asados'],
    ]);
  });

  it('counts slots and dishes after dropping filler', () => {
    const source: SourceMenu = {
      meals: [
        // Resolved and unresolved marked dishes in one slot: a multi-dish slot.
        { day: 'monday', type: 'lunch', dishes: [marked('Merluza al horno'), marked('Pollo al curry con arroz')] },
        // A dish plus filler is not a multi-dish slot.
        { day: 'monday', type: 'dinner', dishes: [unmarked('Pimientos asados'), FRUIT] },
        // Only filler: an empty slot.
        { day: 'tuesday', type: 'lunch', dishes: [FRUIT] },
        { day: 'tuesday', type: 'dinner', dishes: [marked('Lentejas estofadas'), marked('Merluza al horno')] },
      ],
    };

    const { counts } = buildWeeklyMenu(1, source, [
      'Merluza-al-horno',
      'Lentejas-estofadas',
      'Pollo-con-verduras',
      'Tarta-de-queso',
    ]);

    expect(counts).toEqual({
      // 14 slots minus monday/lunch, monday/dinner and tuesday/dinner.
      emptySlots: 11,
      multiDishSlots: 2,
      resolved: 3,
      unmarked: 1,
      unresolved: 1,
      // A discarded candidate does not claim its file; a file resolved twice counts once.
      unclaimedRecipeFiles: 2,
    });
  });

  it('does not count excluded breakfast recipe files as unclaimed', () => {
    const { counts } = buildWeeklyMenu(1, EMPTY_SOURCE, [
      'Tostada-integral-con-un-poco-de-aceite-de-oliva-virgen',
      'Tarta-de-queso',
    ]);

    expect(counts.unclaimedRecipeFiles).toBe(1);
  });
});
