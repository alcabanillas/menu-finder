import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DayDto, RecipeDto, WeekDayDto, WeekDishDto } from '@/application/dto/weekly-menu';
import { WeekCards } from '@/features/weekly-menu/components/week-cards';

const DAYS: DayDto[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const RECIPE: RecipeDto = {
  title: 'Lentejas estofadas',
  times: { total: 45, preparation: 10, cooking: 35, resting: null },
  ingredients: [],
  preparation: [],
};
const plain = (name: string): WeekDishDto => ({ name, recipe: null });
const cooked = (name: string): WeekDishDto => ({ name, recipe: RECIPE });

function week({ sunday = true } = {}): WeekDayDto[] {
  const days: WeekDayDto[] = DAYS.map((day, index) => ({
    day,
    date: `2026-10-${String(5 + index).padStart(2, '0')}`,
    meals: { lunch: [plain(`Comida del día ${5 + index}`)], dinner: [plain(`Cena del día ${5 + index}`)] },
  }));
  days[1].meals = { lunch: [], dinner: [] };
  days[2].meals = { lunch: [cooked('Lentejas estofadas'), plain('Fruta de temporada')], dinner: [] };
  if (!sunday) days[6].meals = { lunch: [], dinner: [] };
  return days;
}

const cards = () => screen.getAllByRole('region');
const card = (weekday: string) => screen.getByRole('region', { name: new RegExp(`^${weekday}`) });
const headings = () => cards().map((region) => within(region).getByRole('heading', { level: 2 }).textContent);

describe('WeekCards', () => {
  it('shows a card per day, Monday to Sunday, each with its weekday and its date', () => {
    render(<WeekCards days={week()} today="2026-10-07" open={null} onOpen={() => {}} />);

    expect(headings()).toEqual(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']);
    expect(card('Lunes')).toHaveTextContent('5 de octubre');
    expect(card('Domingo')).toHaveTextContent('11 de octubre');
  });

  it('says "Hoy" in text on the card of today, and on no other', () => {
    render(<WeekCards days={week()} today="2026-10-07" open={null} onOpen={() => {}} />);

    expect(within(card('Miércoles')).getByText('Hoy')).toBeInTheDocument();
    expect(screen.getAllByText('Hoy')).toHaveLength(1);
  });

  it("lists each meal's dishes in the menu's order, under Comida and Cena", () => {
    render(<WeekCards days={week()} today="2026-10-07" open={null} onOpen={() => {}} />);

    const monday = card('Lunes');
    expect(monday).toHaveTextContent(/Comida\s*Comida del día 5\s*Cena\s*Cena del día 5/);
    expect(card('Miércoles')).toHaveTextContent(/Comida\s*Lentejas estofadas.*Fruta de temporada/);
  });

  it('leaves Sunday out when it has no dishes', () => {
    render(<WeekCards days={week({ sunday: false })} today="2026-10-07" open={null} onOpen={() => {}} />);

    expect(headings()).toEqual(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']);
  });

  it('leaves out a meal with no dishes', () => {
    render(<WeekCards days={week()} today="2026-10-07" open={null} onOpen={() => {}} />);

    expect(within(card('Miércoles')).getByText('Comida')).toBeInTheDocument();
    expect(within(card('Miércoles')).queryByText('Cena')).not.toBeInTheDocument();
  });

  it('says so on a day with no dishes, without meal labels', () => {
    render(<WeekCards days={week()} today="2026-10-07" open={null} onOpen={() => {}} />);

    const tuesday = card('Martes');
    expect(tuesday).toHaveTextContent('El menú no incluye platos para este día.');
    expect(within(tuesday).queryByText('Comida')).not.toBeInTheDocument();
    expect(within(tuesday).queryByText('Cena')).not.toBeInTheDocument();
  });

  it('makes a dish with a recipe a control that opens a dialog, with its time, and one without plain text', () => {
    render(<WeekCards days={week()} today="2026-10-07" open={null} onOpen={() => {}} />);

    const wednesday = card('Miércoles');
    const dish = within(wednesday).getByRole('button', { name: 'Lentejas estofadas' });
    expect(dish).toHaveAttribute('aria-haspopup', 'dialog');
    expect(dish).toHaveAttribute('aria-expanded', 'false');
    expect(wednesday).toHaveTextContent(/Lentejas estofadas\s*45 min/);
    expect(within(wednesday).queryByRole('button', { name: 'Fruta de temporada' })).not.toBeInTheDocument();
    expect(wednesday).not.toHaveTextContent(/Fruta de temporada\s*\d+ min/);
  });

  it('asks to open the dish activated, with the control that opened it', () => {
    const onOpen = vi.fn();
    render(<WeekCards days={week()} today="2026-10-07" open={null} onOpen={onOpen} />);

    const dish = screen.getByRole('button', { name: 'Lentejas estofadas' });
    fireEvent.click(dish);

    expect(onOpen).toHaveBeenCalledWith({ day: 'wednesday', meal: 'lunch', index: 0 }, dish);
  });

  it('announces the open dish as expanded', () => {
    render(
      <WeekCards
        days={week()}
        today="2026-10-07"
        open={{ day: 'wednesday', meal: 'lunch', index: 0 }}
        onOpen={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Lentejas estofadas' })).toHaveAttribute('aria-expanded', 'true');
  });
});
