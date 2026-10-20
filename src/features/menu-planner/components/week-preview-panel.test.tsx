import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MenuPreviewDto } from '@/application/dto/menu-preview';
import { WeekPreviewPanel } from '@/features/menu-planner/components/week-preview-panel';
import type { PreviewState } from '@/features/menu-planner/preview-view';
import type { EvidenceMark } from '@/features/menu-planner/search-view';

const day = (name: MenuPreviewDto['days'][number]['day'], lunch: string[] = [], dinner: string[] = []) => ({ day: name, lunch, dinner });

const PREVIEW: MenuPreviewDto = {
  menuNumber: 22,
  days: [
    day('monday', ['Garbanzos con espinacas'], ['Crema de calabacín']),
    day('tuesday', ['Arroz con verduras']),
    day('wednesday'),
    day('thursday', [], ['Merluza en papillote']),
    day('friday'),
    day('saturday', ['Lentejas']),
    day('sunday'),
  ],
};

const READY: PreviewState = { status: 'ready', preview: PREVIEW };

type Props = Partial<Parameters<typeof WeekPreviewPanel>[0]>;

function panel({ state = READY, marks = [], rank = 2, onClose = vi.fn(), footer = <button type="button">Elegir para el 12 oct</button> }: Props = {}) {
  render(<WeekPreviewPanel menu={22} rank={rank} state={state} marks={marks} footer={footer} onClose={onClose} />);
  return onClose;
}

describe('WeekPreviewPanel', () => {
  it('is a dialog named by "Menú N", with the rank of the card as its eyebrow and a close button', () => {
    panel();

    const dialog = screen.getByRole('dialog', { name: 'Menú 22' });
    expect(within(dialog).getByText('Candidato #2')).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Menú 22' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cerrar vista semanal' })).toBeInTheDocument();
  });

  it('reads "Vista previa" when the cards have no rank', () => {
    panel({ rank: null });

    expect(screen.getByText('Vista previa')).toBeInTheDocument();
    expect(screen.queryByText(/Candidato/)).not.toBeInTheDocument();
  });

  it('lists Monday to Saturday and no Sunday without dishes, each day with its colour bar and the names of its meals', () => {
    panel();

    const days = screen.getAllByRole('region').map((section) => section.getAttribute('aria-label'));
    expect(days).toEqual(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']);
    const monday = screen.getByRole('region', { name: 'Lunes' });
    expect(monday.querySelector('[data-day-bar]')).toHaveClass('bg-day-mon');
    expect(within(monday).getByText('Comida')).toBeInTheDocument();
    expect(within(monday).getByText('Cena')).toBeInTheDocument();
    expect(within(monday).getByText('Garbanzos con espinacas')).toBeInTheDocument();
    expect(within(monday).getByText('Crema de calabacín')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Martes' })).queryByText('Cena')).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Miércoles' })).getByText('Sin platos este día.')).toBeInTheDocument();
  });

  it('lists Sunday when it has dishes', () => {
    const withSunday: PreviewState = {
      status: 'ready',
      preview: { ...PREVIEW, days: [...PREVIEW.days.slice(0, 6), day('sunday', ['Paella'])] },
    };
    panel({ state: withSunday });

    expect(screen.getByRole('region', { name: 'Domingo' })).toBeInTheDocument();
  });

  it('marks the dishes that are evidence with ✓ or ≈ and the terms, and no other dish', () => {
    const marks: EvidenceMark[] = [
      { day: 'monday', meal: 'lunch', name: 'Garbanzos con espinacas', state: 'met', label: 'garbanzos' },
      { day: 'thursday', meal: 'dinner', name: 'Merluza en papillote', state: 'similar', label: 'pescado' },
    ];
    panel({ marks });

    const found = document.querySelectorAll('[data-mark]');
    expect([...found].map((mark) => mark.textContent)).toEqual(['✓ garbanzos', '≈ pescado']);
    expect(found[0]).toHaveClass('text-olive-600');
    expect(found[1]).toHaveClass('text-ochre-700');
    expect(screen.getByRole('region', { name: 'Lunes' })).toContainElement(found[0] as HTMLElement);
    expect(screen.getByRole('region', { name: 'Jueves' })).toContainElement(found[1] as HTMLElement);
  });

  it('does not mark a dish of another day with the same name', () => {
    const marks: EvidenceMark[] = [{ day: 'friday', meal: 'lunch', name: 'Garbanzos con espinacas', state: 'met', label: 'garbanzos' }];
    panel({ marks });

    expect(document.querySelectorAll('[data-mark]')).toHaveLength(0);
  });

  it('says "Cargando…" under the heading while the menu is read', () => {
    panel({ state: null });

    expect(screen.getByRole('heading', { name: 'Menú 22' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('says the message of a read that failed, as an alert', () => {
    panel({ state: { status: 'failed', message: 'No se ha podido cargar la semana. Inténtalo de nuevo.' } });

    expect(screen.getByRole('alert')).toHaveTextContent('No se ha podido cargar la semana. Inténtalo de nuevo.');
  });

  it('has the footer fixed under the body, with what it is given', () => {
    panel();

    const footer = screen.getByRole('button', { name: 'Elegir para el 12 oct' }).closest('[data-footer]');
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveClass('flex-none', 'border-t');
  });

  it('takes the focus on the close button when it opens', () => {
    panel();

    expect(screen.getByRole('button', { name: 'Cerrar vista semanal' })).toHaveFocus();
  });

  it('closes with Escape, with the close button and with the backdrop', () => {
    const onClose = panel();

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar vista semanal' }));
    fireEvent.click(document.querySelector('[data-backdrop]') as HTMLElement);

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('keeps the scroll inside the sheet: the body does not pass it on, and the page behind does not move while the backdrop shows', () => {
    const { unmount } = render(
      <WeekPreviewPanel menu={22} rank={1} state={READY} marks={[]} footer={null} onClose={vi.fn()} />,
    );

    expect(document.querySelector('[data-body]')).toHaveClass('overscroll-contain');
    expect(document.documentElement.style.overflow).toBe('hidden');
    unmount();
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('takes the focus without scrolling the page', () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    panel();

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    focus.mockRestore();
  });

  it('keeps one height on a phone from the first frame, so that the sheet does not jump when the days arrive, and slides in', () => {
    panel({ state: null });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('h-[85dvh]', '@min-[800px]:h-auto');
    expect(dialog).toHaveClass('@max-[799px]:animate-sheet-in');
    expect(document.querySelector('[data-backdrop]')).toHaveClass('@max-[799px]:animate-backdrop-in');
  });

  it('is a bottom sheet on a phone and a 400 px panel below the header on the right from 800 px, where the backdrop goes', () => {
    panel();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('fixed', 'inset-x-0', 'bottom-0', 'rounded-t-lg');
    expect(dialog).toHaveClass('@min-[800px]:top-16', '@min-[800px]:w-[400px]');
    expect(document.querySelector('[data-backdrop]')).toHaveClass('@min-[800px]:hidden');
  });
});
