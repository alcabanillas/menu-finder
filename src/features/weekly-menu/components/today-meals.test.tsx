import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
MENU.days[3].meals = { lunch: [], dinner: [plain('Crema de calabacín'), plain('Yogur natural')] };
MENU.days[6].meals = { lunch: [plain('Paella de verduras')], dinner: [] };

// Both views are in the page and CSS shows one (design D9): the phone's first, then the one from 800 px.
const phoneMeal = (meal: string) => screen.getAllByRole('region', { name: meal })[0];
const desktopMeal = (meal: string) => screen.getAllByRole('region', { name: meal })[1];
const dishesOnPhone = (meal: string) =>
  within(phoneMeal(meal))
    .getAllByRole('article')
    .map((card) => card.querySelector('p, button span span')?.textContent);
const tomorrow = () => screen.getByRole('region', { name: /^Mañana/ });

describe('TodayMeals', () => {
  it('has no heading of its own, and links to the whole week', () => {
    render(<TodayMeals menu={MENU} />);

    expect(screen.queryByRole('heading', { name: 'Qué toca hoy' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver menú' })).toHaveAttribute('href', '/menu');
  });

  it('hides a meal with no dishes', () => {
    render(<TodayMeals menu={{ ...MENU, today: '2026-10-08' }} />);

    expect(screen.queryByRole('region', { name: 'Comida' })).not.toBeInTheDocument();
    expect(dishesOnPhone('Cena')).toEqual(['Crema de calabacín', 'Yogur natural']);
  });

  it('says the menu has no dishes for today when both meals are empty', () => {
    render(<TodayMeals menu={{ ...MENU, today: '2026-10-10' }} />);

    expect(screen.getByText('El menú no incluye platos para hoy.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Comida' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Cena' })).not.toBeInTheDocument();
  });

  it('renders the phone view and the one from 800 px, each hidden at the other width', () => {
    render(<TodayMeals menu={MENU} />);

    expect(phoneMeal('Comida').parentElement).toHaveClass('@min-[800px]:hidden');
    expect(desktopMeal('Comida').parentElement).toHaveClass('hidden', '@min-[800px]:grid');
  });
});

describe('TodayMeals on a phone', () => {
  it("shows every dish of today's lunch and dinner under Comida and Cena, and none of another day", () => {
    render(<TodayMeals menu={MENU} />);

    expect(dishesOnPhone('Comida')).toEqual(['Lentejas estofadas', 'Fruta de temporada']);
    expect(dishesOnPhone('Cena')).toEqual(['Sepia a la plancha']);
    expect(screen.queryByText('Arroz al horno')).not.toBeInTheDocument();
  });

  it('unfolds the recipe of a dish that has one, and says when a dish has none', () => {
    render(<TodayMeals menu={MENU} />);

    const dish = within(phoneMeal('Comida')).getByRole('button', { name: /Lentejas estofadas/ });
    fireEvent.click(dish);

    expect(dish).toHaveAttribute('aria-expanded', 'true');
    expect(within(phoneMeal('Comida')).getByText('Cocer.')).toBeInTheDocument();
    expect(within(phoneMeal('Cena')).getByText('Sin receta')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('TodayMeals from 800 px', () => {
  const dish = (name: string) => within(desktopMeal('Comida')).getByRole('button', { name });

  afterEach(() => vi.restoreAllMocks());

  it('shows each dish as a row with its total time; only a dish with a recipe is a control', () => {
    render(<TodayMeals menu={MENU} />);

    expect(dish('Lentejas estofadas')).toHaveAttribute('aria-haspopup', 'dialog');
    expect(dish('Lentejas estofadas').parentElement).toHaveTextContent(/^Lentejas estofadas\s*30 min$/);
    expect(within(desktopMeal('Comida')).getByText('Fruta de temporada').tagName).not.toBe('BUTTON');
    expect(within(desktopMeal('Cena')).queryByRole('button')).not.toBeInTheDocument();
  });

  it('opens the recipe in the side panel, not in the page, and announces the dish as expanded', () => {
    render(<TodayMeals menu={MENU} />);

    fireEvent.click(dish('Lentejas estofadas'));

    const dialog = screen.getByRole('dialog', { name: 'Lentejas estofadas' });
    expect(within(dialog).getByText('Miércoles · Comida')).toBeInTheDocument();
    expect(within(dialog).getByText('Cocer.')).toBeInTheDocument();
    expect(within(desktopMeal('Comida')).queryByText('Cocer.')).not.toBeInTheDocument();
    expect(dish('Lentejas estofadas')).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes on Escape and gives the focus back to the dish', () => {
    render(<TodayMeals menu={MENU} />);
    fireEvent.click(dish('Lentejas estofadas'));

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(dish('Lentejas estofadas')).toHaveFocus();
    expect(dish('Lentejas estofadas')).toHaveAttribute('aria-expanded', 'false');
  });

  it('lies on the side of the page away from the dish', () => {
    render(<TodayMeals menu={MENU} />);
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1280);
    vi.spyOn(dish('Lentejas estofadas'), 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 100, y: 0, width: 160, height: 20 }),
    );

    fireEvent.click(dish('Lentejas estofadas'));

    expect(screen.getByRole('dialog')).toHaveAttribute('data-side', 'right');
  });
});

describe('TodayMeals, tomorrow', () => {
  it("names tomorrow's day and only the names of its dishes, with no control and no time", () => {
    render(<TodayMeals menu={MENU} />);

    expect(tomorrow()).toHaveAccessibleName('Mañana, jueves 8');
    expect(within(tomorrow()).getByText('Mañana · jueves 8')).toBeInTheDocument();
    expect(within(tomorrow()).queryByRole('button')).not.toBeInTheDocument();
    expect(within(tomorrow()).queryByText(/min/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver menú' }).compareDocumentPosition(tomorrow())).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('is a box per meal with a dish per line: one column on a phone, two from 800 px', () => {
    render(<TodayMeals menu={{ ...MENU, today: '2026-10-05' }} />);

    const [boxes, ...others] = tomorrow().querySelectorAll(':scope > div');
    expect(others).toHaveLength(0);
    expect(boxes).toHaveClass('grid', 'grid-cols-1', '@min-[800px]:grid-cols-2');
    expect([...boxes.children].map((box) => [...box.querySelectorAll('p')].map((line) => line.textContent))).toEqual([
      ['Arroz al horno'],
      ['Tortilla francesa'],
    ]);
  });

  it('leaves out a meal with no dishes', () => {
    render(<TodayMeals menu={MENU} />);

    const [boxes] = tomorrow().querySelectorAll(':scope > div');
    expect(boxes.children).toHaveLength(1);
    expect(boxes).toHaveTextContent(/^Cena\s*Crema de calabacínYogur natural$/);
  });

  it('is not shown when tomorrow has no dishes', () => {
    render(<TodayMeals menu={{ ...MENU, today: '2026-10-09' }} />);

    expect(screen.queryByText(/^Mañana/)).not.toBeInTheDocument();
  });

  it('is not shown on Sunday, when tomorrow is in another week', () => {
    render(<TodayMeals menu={{ ...MENU, today: '2026-10-11' }} />);

    expect(screen.queryByText(/^Mañana/)).not.toBeInTheDocument();
  });
});
