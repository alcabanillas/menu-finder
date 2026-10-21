import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DayDto, WeeklyMenuDto, WeekDishDto } from '@/application/dto/weekly-menu';
import { WeeklyMenu } from '@/features/weekly-menu/components/weekly-menu';

const DAYS: DayDto[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const plain = (name: string): WeekDishDto => ({ name, recipe: null });
const cooked = (name: string): WeekDishDto => ({
  name,
  recipe: {
    title: name,
    times: { total: 30, preparation: 10, cooking: 20, resting: null },
    ingredients: [],
    preparation: [],
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
MENU.days[0].meals = { lunch: [plain('Garbanzos con espinacas')], dinner: [cooked('Crema de calabacín')] };
MENU.days[2].meals = {
  lunch: [plain('Lentejas estofadas'), plain('Fruta de temporada')],
  dinner: [plain('Sepia a la plancha')],
};
MENU.days[5].meals = { lunch: [cooked('Arroz con verduras')], dinner: [] };

const daySection = (dayHeading: string) =>
  screen.getByRole('heading', { level: 2, name: dayHeading }).closest('section')!;
const dishesUnder = (section: HTMLElement, meal: string) =>
  within(within(section).getByRole('region', { name: meal }))
    .getAllByRole('article')
    .map((card) => card.querySelector('p')?.textContent);

describe('WeeklyMenu', () => {
  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('heads the page with the menu number and the Monday of its week', () => {
    render(<WeeklyMenu menu={MENU} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Menú 3' })).toBeInTheDocument();
    expect(screen.getByText('Semana del 5 de octubre')).toBeInTheDocument();
  });

  it('renders all seven days sequentially in mobile view without requiring tab clicks', () => {
    render(<WeeklyMenu menu={MENU} />);

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toContain('Lunes 5 de octubre');
    expect(headings).toContain('Martes 6 de octubre');
    expect(headings).toContain('Miércoles 7 de octubre');
    expect(headings).toContain('Jueves 8 de octubre');
    expect(headings).toContain('Viernes 9 de octubre');
    expect(headings).toContain('Sábado 10 de octubre');
    expect(headings).toContain('Domingo 11 de octubre');
  });

  it("shows today's dishes under Comida and Cena, in the menu's order", () => {
    render(<WeeklyMenu menu={MENU} />);

    const wednesday = daySection('Miércoles 7 de octubre');
    expect(dishesUnder(wednesday, 'Comida')).toEqual(['Lentejas estofadas', 'Fruta de temporada']);
    expect(dishesUnder(wednesday, 'Cena')).toEqual(['Sepia a la plancha']);
  });

  it('labels each day section with its heading', () => {
    render(<WeeklyMenu menu={MENU} />);

    expect(daySection('Miércoles 7 de octubre')).toHaveAccessibleName('Miércoles 7 de octubre');
  });

  it('shows dishes on another day in continuous scroll', () => {
    render(<WeeklyMenu menu={MENU} />);

    const monday = daySection('Lunes 5 de octubre');
    expect(dishesUnder(monday, 'Comida')).toEqual(['Garbanzos con espinacas']);
  });

  it('says so on a day with no dishes, without Comida or Cena', () => {
    render(<WeeklyMenu menu={MENU} />);

    const sunday = daySection('Domingo 11 de octubre');
    expect(within(sunday).getByText('El menú no incluye platos para este día.')).toBeInTheDocument();
    expect(within(sunday).queryByRole('region')).not.toBeInTheDocument();
  });

  it('scrolls to the corresponding day section when clicking a day button in the sticky nav', () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    render(<WeeklyMenu menu={MENU} />);

    fireEvent.click(screen.getByRole('button', { name: 'Lun 5' }));

    const mondaySection = screen.getByRole('heading', { level: 2, name: 'Lunes 5 de octubre' }).closest('section')!;
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(scrollIntoViewMock.mock.instances).toContain(mondaySection);
  });

  it("anchors viewport to today's day section on initial mount", () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    render(<WeeklyMenu menu={MENU} />);

    const wednesdaySection = screen.getByRole('heading', { level: 2, name: 'Miércoles 7 de octubre' }).closest('section')!;
    expect(scrollIntoViewMock).toHaveBeenCalled();
    expect(scrollIntoViewMock.mock.instances).toContain(wednesdaySection);
  });

  it('updates the active day button in the sticky nav when scrolling brings another day into view', () => {
    let observerCallback: IntersectionObserverCallback | null = null;
    const observeMock = vi.fn();
    const disconnectMock = vi.fn();

    class MockIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }
      observe = observeMock;
      disconnect = disconnectMock;
      unobserve = vi.fn();
      takeRecords = () => [];
    }

    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

    render(<WeeklyMenu menu={MENU} />);

    expect(screen.getByRole('button', { name: 'Mié 7 hoy' })).toHaveAttribute('aria-current', 'true');

    const thursdaySection = screen.getByRole('heading', { level: 2, name: 'Jueves 8 de octubre' }).closest('section')!;
    act(() => {
      observerCallback?.(
        [
          {
            target: thursdaySection,
            isIntersecting: true,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );
    });

    expect(screen.getByRole('button', { name: 'Jue 8' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Mié 7 hoy' })).not.toHaveAttribute('aria-current');
  });

  it("keeps the day bar under the shell's sticky header, which is 56 px high and 64 px from 800 px", () => {
    render(<WeeklyMenu menu={MENU} />);

    const bar = screen.getByRole('navigation', { name: 'Días de la semana' }).parentElement;
    expect(bar).toHaveClass('sticky', 'top-14', 'min-[800px]:top-16');
  });

  it('leaves room for the header and the day bar above a day the page scrolls to', () => {
    render(<WeeklyMenu menu={MENU} />);

    // Header (56 or 64 px) plus the day bar (64 px buttons and 8 px of padding): 128 px, 136 px from 640 px.
    expect(daySection('Lunes 5 de octubre')).toHaveClass('scroll-mt-32', 'min-[800px]:scroll-mt-34');
  });

  it('lets the last day reach the top however short it is, so the bar can mark it', () => {
    render(<WeeklyMenu menu={MENU} />);

    // A viewport high minus the header and the day bar, as `scroll-mt` above.
    expect(daySection('Domingo 11 de octubre')).toHaveClass(
      'last:min-h-[calc(100dvh-8rem)]',
      'min-[800px]:last:min-h-[calc(100dvh-8.5rem)]',
    );
  });

  it('does not scroll on opening a week that does not hold today', () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    render(<WeeklyMenu menu={{ ...MENU, today: '2026-10-14' }} />);

    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it('jumps to the day without animation when the user prefers reduced motion', () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }));

    render(<WeeklyMenu menu={MENU} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lun 5' }));

    expect(scrollIntoViewMock).toHaveBeenLastCalledWith({ behavior: 'auto', block: 'start' });
  });

  it('renders the day view for narrow screens and the day cards for wide ones, each hidden at the other width', () => {
    render(<WeeklyMenu menu={MENU} />);

    const mobileFeed = daySection('Lunes 5 de octubre').parentElement?.parentElement;
    expect(mobileFeed).toHaveClass('@min-[800px]:hidden');
    const lunesRegions = screen.getAllByRole('region', { name: /^Lunes/ });
    expect(lunesRegions[1].closest('.hidden')).toHaveClass('@min-[800px]:block');
  });
});

describe('WeeklyMenu, the recipe panel', () => {
  // The day cards' dishes: the dish names alone, while the mobile view's cards carry the time and "Receta" too.
  const dish = (name: string) => screen.getByRole('button', { name });
  // Puts the dish's button at `left` px of the viewport.
  const placeAt = (name: string, left: number) => {
    vi.spyOn(dish(name), 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: left, y: 0, width: 160, height: 20 }),
    );
  };

  afterEach(() => vi.restoreAllMocks());

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

  it('lies on the right whatever the place of the dish: it is modal, so it may cover it', () => {
    render(<WeeklyMenu menu={MENU} />);
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1280);
    placeAt('Crema de calabacín', 900);

    fireEvent.click(dish('Crema de calabacín'));

    expect(screen.getByRole('dialog')).toHaveClass('right-0');
    expect(screen.getByRole('dialog')).not.toHaveAttribute('data-side');
  });
});
