import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DayDto, WeekDishDto, WeeklyMenuDto } from '@/application/dto/weekly-menu';
import { TodayMeals } from '@/features/weekly-menu/components/today-meals';

const DAYS: DayDto[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const plain = (name: string): WeekDishDto => ({ name, recipe: null });
const cooked = (name: string): WeekDishDto => ({
  name,
  recipe: {
    title: name,
    times: { total: 30, preparation: 10, cooking: 20, resting: null },
    ingredients: [],
    preparation: ['Cocer.'],
  },
});

const MENU: WeeklyMenuDto = {
  menuNumber: 3,
  startsOn: '2026-10-05',
  today: '2026-10-07',
  days: DAYS.map((day, index) => ({
    day,
    date: `2026-10-${String(5 + index).padStart(2, '0')}`,
    meals: { lunch: [], dinner: [] },
  })),
};
MENU.days[1].meals = { lunch: [plain('Arroz al horno')], dinner: [plain('Tortilla francesa')] };
MENU.days[2].meals = {
  lunch: [cooked('Lentejas estofadas'), plain('Fruta de temporada')],
  dinner: [plain('Sepia a la plancha')],
};
MENU.days[3].meals = { lunch: [], dinner: [plain('Crema de calabacín')] };

const dishesUnder = (meal: string) =>
  within(screen.getByRole('region', { name: meal }))
    .getAllByRole('article')
    .map((card) => card.querySelector('p, button span span')?.textContent);

describe('TodayMeals', () => {
  it('has no heading of its own, and links to the whole week', () => {
    render(<TodayMeals menu={MENU} />);

    expect(screen.queryByRole('heading', { name: 'Qué toca hoy' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver menú' })).toHaveAttribute('href', '/menu');
  });

  it('hides a meal with no dishes', () => {
    render(<TodayMeals menu={{ ...MENU, today: '2026-10-08' }} />);

    expect(screen.queryByRole('region', { name: 'Comida' })).not.toBeInTheDocument();
    expect(dishesUnder('Cena')).toEqual(['Crema de calabacín']);
  });

  it('says the menu has no dishes for today when both meals are empty', () => {
    render(<TodayMeals menu={{ ...MENU, today: '2026-10-11' }} />);

    expect(screen.getByText('El menú no incluye platos para hoy.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Comida' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Cena' })).not.toBeInTheDocument();
  });

  it("shows every dish of today's lunch and dinner under Comida and Cena, and none of another day", () => {
    render(<TodayMeals menu={MENU} />);

    expect(dishesUnder('Comida')).toEqual(['Lentejas estofadas', 'Fruta de temporada']);
    expect(dishesUnder('Cena')).toEqual(['Sepia a la plancha']);
    expect(screen.queryByText('Arroz al horno')).not.toBeInTheDocument();
  });

  it('unfolds the recipe of a dish that has one, and says when a dish has none', () => {
    render(<TodayMeals menu={MENU} />);

    const dish = screen.getByRole('button', { name: /Lentejas estofadas/ });
    fireEvent.click(dish);

    expect(dish).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Cocer.')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Cena' })).getByText('Sin receta')).toBeInTheDocument();
  });
});
