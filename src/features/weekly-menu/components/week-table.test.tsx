import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DayDto, RecipeDto, WeekDayDto, WeekDishDto } from '@/application/dto/weekly-menu';
import { WeekTable } from '@/features/weekly-menu/components/week-table';

const DAYS: DayDto[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const RECIPE: RecipeDto = {
  title: 'Lentejas estofadas',
  times: { total: 45, preparation: 10, cooking: 35, resting: null },
  ingredients: [],
  preparation: [],
};
const plain = (name: string): WeekDishDto => ({ name, recipe: null });
const cooked = (name: string): WeekDishDto => ({ name, recipe: RECIPE });

function week(sunday = true): WeekDayDto[] {
  const days: WeekDayDto[] = DAYS.map((day, index) => ({
    day,
    date: `2026-10-${String(5 + index).padStart(2, '0')}`,
    meals: { lunch: [plain(`Comida del día ${5 + index}`)], dinner: [plain(`Cena del día ${5 + index}`)] },
  }));
  days[2].meals = { lunch: [cooked('Lentejas estofadas'), plain('Fruta de temporada')], dinner: [] };
  if (!sunday) days[6].meals = { lunch: [], dinner: [] };
  return days;
}

const columnHeaders = () => screen.getAllByRole('columnheader').map((header) => header.textContent);
// The first row holds the column headers.
const ROWS = { Comida: 1, Cena: 2 };
const cell = (row: keyof typeof ROWS, column: number) =>
  within(screen.getAllByRole('row')[ROWS[row]]).getAllByRole('cell')[column];

describe('WeekTable', () => {
  it('shows the week as a table: a column per day with its date, and today marked "hoy" in text', () => {
    render(<WeekTable days={week()} today="2026-10-07" open={null} onOpen={() => {}} />);

    expect(screen.getByRole('table', { name: 'Menú de la semana' })).toBeInTheDocument();
    expect(columnHeaders()).toEqual([
      'Comida o cena',
      'Lunes5 oct',
      'Martes6 oct',
      'Miércoles7 oct · hoy',
      'Jueves8 oct',
      'Viernes9 oct',
      'Sábado10 oct',
      'Domingo11 oct',
    ]);
  });

  it("lists each meal's dishes in the menu's order, under the rows Comida and Cena", () => {
    render(<WeekTable days={week()} today="2026-10-07" open={null} onOpen={() => {}} />);

    expect(screen.getAllByRole('rowheader').map((header) => header.textContent)).toEqual(['Comida', 'Cena']);
    expect(cell('Comida', 0)).toHaveTextContent('Comida del día 5');
    expect(cell('Comida', 2)).toHaveTextContent(/^Lentejas estofadas\s*Fruta de temporada$/);
  });

  it('leaves Sunday out when it has no dishes', () => {
    render(<WeekTable days={week(false)} today="2026-10-07" open={null} onOpen={() => {}} />);

    expect(columnHeaders()).toHaveLength(7);
    expect(columnHeaders()).not.toContain('Domingo11 oct');
  });

  it('gives every dish of a meal the same weight: the second is no less a dish than the first', () => {
    render(<WeekTable days={week()} today="2026-10-07" open={null} onOpen={() => {}} />);

    const [first, second] = Array.from(cell('Comida', 2).children);
    expect(second.className).toBe(first.className);
  });

  it('shows a dash for a meal with no dishes', () => {
    render(<WeekTable days={week()} today="2026-10-07" open={null} onOpen={() => {}} />);

    expect(cell('Cena', 2)).toHaveTextContent(/^—$/);
  });

  it('makes a dish with a recipe a control that opens a dialog, and leaves one without as plain text', () => {
    render(<WeekTable days={week()} today="2026-10-07" open={null} onOpen={() => {}} />);

    const dish = within(cell('Comida', 2)).getByRole('button', { name: 'Lentejas estofadas' });
    expect(dish).toHaveAttribute('aria-haspopup', 'dialog');
    expect(dish).toHaveAttribute('aria-expanded', 'false');
    expect(within(cell('Comida', 2)).queryByRole('button', { name: 'Fruta de temporada' })).not.toBeInTheDocument();
  });

  it('asks to open the dish activated, with the control that opened it', () => {
    const onOpen = vi.fn();
    render(<WeekTable days={week()} today="2026-10-07" open={null} onOpen={onOpen} />);

    const dish = screen.getByRole('button', { name: 'Lentejas estofadas' });
    fireEvent.click(dish);

    expect(onOpen).toHaveBeenCalledWith({ day: 'wednesday', meal: 'lunch', index: 0 }, dish);
  });

  it('announces the open dish as expanded', () => {
    render(
      <WeekTable
        days={week()}
        today="2026-10-07"
        open={{ day: 'wednesday', meal: 'lunch', index: 0 }}
        onOpen={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Lentejas estofadas' })).toHaveAttribute('aria-expanded', 'true');
  });
});
