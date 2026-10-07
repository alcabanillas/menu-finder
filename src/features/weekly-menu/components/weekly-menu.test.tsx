import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DayDto, WeeklyMenuDto, WeekDishDto } from '@/application/dto/weekly-menu';
import { WeeklyMenu } from '@/features/weekly-menu/components/weekly-menu';

const DAYS: DayDto[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const plain = (name: string): WeekDishDto => ({ name, recipe: null });
const cooked = (name: string): WeekDishDto => ({
  name,
  recipe: { title: name, times: { total: 30, preparation: 10, cooking: 20, resting: null }, ingredients: [], preparation: [] },
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
MENU.days[0].meals = { lunch: [plain('Garbanzos con espinacas')], dinner: [cooked('Crema de calabacín')] };
MENU.days[2].meals = {
  lunch: [plain('Lentejas estofadas'), plain('Fruta de temporada')],
  dinner: [plain('Sepia a la plancha')],
};
MENU.days[5].meals = { lunch: [cooked('Arroz con verduras')], dinner: [] };

const panel = () => screen.getByRole('tabpanel');
const dishesUnder = (meal: string) =>
  within(within(panel()).getByRole('region', { name: meal }))
    .getAllByRole('article')
    .map((card) => card.querySelector('p')?.textContent);

describe('WeeklyMenu', () => {
  it('heads the page with the menu number and the Monday of its week', () => {
    render(<WeeklyMenu menu={MENU} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Menú 3' })).toBeInTheDocument();
    expect(screen.getByText('Semana del 5 de octubre')).toBeInTheDocument();
  });

  it("opens on today's tab and shows today's dishes under Comida and Cena, in the menu's order", () => {
    render(<WeeklyMenu menu={MENU} />);

    expect(screen.getByRole('tab', { selected: true })).toHaveAccessibleName('Mié 7 hoy');
    expect(within(panel()).getByRole('heading', { level: 2, name: 'Miércoles 7 de octubre' })).toBeInTheDocument();
    expect(dishesUnder('Comida')).toEqual(['Lentejas estofadas', 'Fruta de temporada']);
    expect(dishesUnder('Cena')).toEqual(['Sepia a la plancha']);
  });

  it('labels the panel with its tab', () => {
    render(<WeeklyMenu menu={MENU} />);

    expect(panel()).toHaveAccessibleName('Mié 7 hoy');
  });

  it('shows another day when its tab is selected', () => {
    render(<WeeklyMenu menu={MENU} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Lun 5' }));

    expect(within(panel()).getByRole('heading', { level: 2, name: 'Lunes 5 de octubre' })).toBeInTheDocument();
    expect(dishesUnder('Comida')).toEqual(['Garbanzos con espinacas']);
  });

  it('says so on a day with no dishes, without Comida or Cena', () => {
    render(<WeeklyMenu menu={MENU} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Dom 11' }));

    expect(within(panel()).getByText('El menú no incluye platos para este día.')).toBeInTheDocument();
    expect(within(panel()).queryByRole('region')).not.toBeInTheDocument();
  });

  it('renders the day view for narrow screens and the week table for wide ones, each hidden at the other width', () => {
    render(<WeeklyMenu menu={MENU} />);

    expect(panel().parentElement).toHaveClass('@min-[800px]:hidden');
    expect(screen.getByRole('table', { name: 'Menú de la semana' }).parentElement).toHaveClass(
      'hidden',
      '@min-[800px]:block',
    );
  });
});

describe('WeeklyMenu, the recipe panel', () => {
  const table = () => screen.getByRole('table', { name: 'Menú de la semana' });
  const dish = (name: string) => within(table()).getByRole('button', { name });

  it('opens a dish in a dialog that takes the focus, and announces the dish as expanded', () => {
    render(<WeeklyMenu menu={MENU} />);

    fireEvent.click(dish('Crema de calabacín'));

    const dialog = screen.getByRole('dialog', { name: 'Crema de calabacín' });
    expect(within(dialog).getByText('Lunes · Cena')).toBeInTheDocument();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(dish('Crema de calabacín')).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes on Escape and gives the focus back to the dish, now collapsed', () => {
    render(<WeeklyMenu menu={MENU} />);
    fireEvent.click(dish('Crema de calabacín'));

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(dish('Crema de calabacín')).toHaveFocus();
    expect(dish('Crema de calabacín')).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes with its close button and gives the focus back to the dish', () => {
    render(<WeeklyMenu menu={MENU} />);
    fireEvent.click(dish('Crema de calabacín'));

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar receta' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(dish('Crema de calabacín')).toHaveFocus();
  });

  it('shows another dish opened while it is open, and only that one is expanded', () => {
    render(<WeeklyMenu menu={MENU} />);
    fireEvent.click(dish('Crema de calabacín'));

    fireEvent.click(dish('Arroz con verduras'));

    expect(screen.getByRole('dialog', { name: 'Arroz con verduras' })).toBeInTheDocument();
    expect(dish('Arroz con verduras')).toHaveAttribute('aria-expanded', 'true');
    expect(dish('Crema de calabacín')).toHaveAttribute('aria-expanded', 'false');
  });

  it("lies on the side away from the dish's column", () => {
    render(<WeeklyMenu menu={MENU} />);

    fireEvent.click(dish('Crema de calabacín'));
    expect(screen.getByRole('dialog')).toHaveAttribute('data-side', 'right');

    fireEvent.click(dish('Arroz con verduras'));
    expect(screen.getByRole('dialog')).toHaveAttribute('data-side', 'left');
  });
});
