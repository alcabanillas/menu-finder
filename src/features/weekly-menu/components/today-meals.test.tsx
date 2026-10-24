import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DayDto, WeekDayDto, WeekDishDto, WeeklyMenuDto } from '@/application/dto/weekly-menu';
import type { TomorrowDto } from '@/application/dto/todays-menu';
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

// What `todaysMenu` hands over for a day of MENU: tomorrow is the next day of the week, or none when it has no dishes.
const hasDishes = ({ meals }: WeekDayDto) => meals.lunch.length + meals.dinner.length > 0;
const renderToday = (date = MENU.today, tomorrow?: TomorrowDto) => {
  const index = MENU.days.findIndex((day) => day.date === date);
  const next = MENU.days[index + 1];
  const fallback: TomorrowDto = next && hasDishes(next) ? { kind: 'day', day: next } : { kind: 'none' };
  return render(<TodayMeals today={MENU.days[index]} tomorrow={tomorrow ?? fallback} />);
};

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
    renderToday();

    expect(screen.queryByRole('heading', { name: 'Qué toca hoy' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver menú' })).toHaveAttribute('href', '/menu');
  });

  it('hides a meal with no dishes', () => {
    renderToday('2026-10-08');

    expect(screen.queryByRole('region', { name: 'Comida' })).not.toBeInTheDocument();
    expect(dishesOnPhone('Cena')).toEqual(['Crema de calabacín', 'Yogur natural']);
  });

  it('says the menu has no dishes for today when both meals are empty', () => {
    renderToday('2026-10-10');

    expect(screen.getByText('El menú no incluye platos para hoy.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Comida' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Cena' })).not.toBeInTheDocument();
  });

  it('renders the phone view and the one from 800 px, each hidden at the other width', () => {
    renderToday();

    expect(phoneMeal('Comida').parentElement).toHaveClass('@min-[800px]:hidden');
    expect(desktopMeal('Comida').parentElement).toHaveClass('hidden', '@min-[800px]:grid');
  });
});

describe('TodayMeals on a phone', () => {
  it("shows every dish of today's lunch and dinner under Comida and Cena, and none of another day", () => {
    renderToday();

    expect(dishesOnPhone('Comida')).toEqual(['Lentejas estofadas', 'Fruta de temporada']);
    expect(dishesOnPhone('Cena')).toEqual(['Sepia a la plancha']);
    expect(screen.queryByText('Arroz al horno')).not.toBeInTheDocument();
  });

  it('unfolds the recipe of a dish that has one, and says when a dish has none', () => {
    renderToday();

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
    renderToday();

    expect(dish('Lentejas estofadas')).toHaveAttribute('aria-haspopup', 'dialog');
    expect(dish('Lentejas estofadas').parentElement).toHaveTextContent(/^Lentejas estofadas\s*30 min$/);
    expect(within(desktopMeal('Comida')).getByText('Fruta de temporada').tagName).not.toBe('BUTTON');
    expect(within(desktopMeal('Cena')).queryByRole('button')).not.toBeInTheDocument();
  });

  it('opens the recipe in the side panel, not in the page, and announces the dish as expanded', () => {
    renderToday();

    fireEvent.click(dish('Lentejas estofadas'));

    const dialog = screen.getByRole('dialog', { name: 'Lentejas estofadas' });
    expect(within(dialog).getByText('Miércoles · Comida')).toBeInTheDocument();
    expect(within(dialog).getByText('Cocer.')).toBeInTheDocument();
    expect(within(desktopMeal('Comida')).queryByText('Cocer.')).not.toBeInTheDocument();
    expect(dish('Lentejas estofadas')).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes on Escape and gives the focus back to the dish', () => {
    renderToday();
    fireEvent.click(dish('Lentejas estofadas'));

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(dish('Lentejas estofadas')).toHaveFocus();
    expect(dish('Lentejas estofadas')).toHaveAttribute('aria-expanded', 'false');
  });

  it('lies on the right whatever the place of the dish: it is modal, so it may cover it', () => {
    renderToday();
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1280);
    vi.spyOn(dish('Lentejas estofadas'), 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 900, y: 0, width: 160, height: 20 }),
    );

    fireEvent.click(dish('Lentejas estofadas'));

    expect(screen.getByRole('dialog')).toHaveClass('right-0');
    expect(screen.getByRole('dialog')).not.toHaveAttribute('data-side');
  });
});

describe('TodayMeals, tomorrow', () => {
  it("names tomorrow's day and only the names of its dishes, with no control and no time", () => {
    renderToday();

    expect(tomorrow()).toHaveAccessibleName('Mañana, jueves 8');
    expect(within(tomorrow()).getByText('Mañana · jueves 8')).toBeInTheDocument();
    expect(within(tomorrow()).queryByRole('button')).not.toBeInTheDocument();
    expect(within(tomorrow()).queryByText(/min/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver menú' }).compareDocumentPosition(tomorrow())).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('is a box per meal with a dish per line: one column on a phone, two from 800 px', () => {
    renderToday('2026-10-05');

    const [boxes, ...others] = tomorrow().querySelectorAll(':scope > div');
    expect(others).toHaveLength(0);
    expect(boxes).toHaveClass('grid', 'grid-cols-1', '@min-[800px]:grid-cols-2');
    expect([...boxes.children].map((box) => [...box.querySelectorAll('p')].map((line) => line.textContent))).toEqual([
      ['Arroz al horno'],
      ['Tortilla francesa'],
    ]);
  });

  it('leaves out a meal with no dishes', () => {
    renderToday();

    const [boxes] = tomorrow().querySelectorAll(':scope > div');
    expect(boxes.children).toHaveLength(1);
    expect(boxes).toHaveTextContent(/^Cena\s*Crema de calabacínYogur natural$/);
  });

  it('is not shown when tomorrow has no dishes', () => {
    renderToday('2026-10-09');

    expect(screen.queryByText(/^Mañana/)).not.toBeInTheDocument();
  });
});

const SUNDAY: WeekDayDto = { day: 'sunday', date: '2026-10-11', meals: { lunch: [], dinner: [] } };
const NEXT_MONDAY: WeekDayDto = {
  day: 'monday',
  date: '2026-10-12',
  meals: { lunch: [plain('Lentejas estofadas')], dinner: [plain('Tortilla francesa')] },
};
const onSunday = (tomorrow: TomorrowDto) => render(<TodayMeals today={SUNDAY} tomorrow={tomorrow} />);

describe('TodayMeals on a Sunday', () => {
  it('is a rest day: a card "Domingo libre", with no meals, no "no dishes" line and no link to the menu', () => {
    onSunday({ kind: 'none' });

    expect(screen.getByText('Domingo libre')).toBeInTheDocument();
    expect(
      screen.getByText('¡Día libre! Hoy la cocina queda a vuestro gusto.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('El menú no incluye platos para hoy.')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Comida' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Cena' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver menú' })).not.toBeInTheDocument();
  });

  it("shows next week's Monday with its menu number, its dishes and the way to its menu", () => {
    onSunday({ kind: 'next-week', day: NEXT_MONDAY, menuNumber: 31, startsOn: '2026-10-12' });

    expect(within(tomorrow()).getByText('Mañana · Lunes 12 · Menú 31')).toBeInTheDocument();
    expect(within(tomorrow()).getByText('Lentejas estofadas')).toBeInTheDocument();
    expect(within(tomorrow()).getByText('Tortilla francesa')).toBeInTheDocument();
    expect(within(tomorrow()).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver el menú de la semana que viene' })).toHaveAttribute(
      'href',
      '/menu?startsOn=2026-10-12',
    );
  });

  it('says next week has no menu yet and offers to choose it, with no "Mañana"', () => {
    onSunday({ kind: 'no-menu', startsOn: '2026-10-12' });

    expect(screen.getByText('La semana que viene aún no tiene menú')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Mañana empieza otra semana. Elige uno en Buscar: escribe lo que os apetece y verás los menús que encajan.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Elegir menú para el 12 oct' })).toHaveAttribute(
      'href',
      '/planner?week=next',
    );
    expect(screen.queryByRole('region', { name: /^Mañana/ })).not.toBeInTheDocument();
  });

  it("shows no \"Mañana\" when next week's Monday has no dishes", () => {
    onSunday({ kind: 'none' });

    expect(screen.queryByText(/^Mañana/)).not.toBeInTheDocument();
    expect(screen.queryByText('La semana que viene aún no tiene menú')).not.toBeInTheDocument();
  });
});
