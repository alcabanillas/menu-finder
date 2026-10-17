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

const dishesUnder = (meal: string) =>
  within(screen.getByRole('region', { name: meal }))
    .getAllByRole('article')
    .map((card) => card.querySelector('p, button span span')?.textContent);

describe('TodayMeals', () => {
  it('heads the block with what is on today', () => {
    render(<TodayMeals menu={MENU} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Qué toca hoy' })).toBeInTheDocument();
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
