import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ShoppingChecklistDto } from '@/application/dto/shopping-checklist';
import type { CheckItemsState } from '@/features/shopping-list/check-items-state';
import { ShoppingChecklist } from '@/features/shopping-list/components/shopping-checklist';

const item = (position: number, name: string, quantity: number | null, unit: string | null, checked: boolean, optional = false) => ({
  position,
  name,
  quantity,
  unit,
  optional,
  checked,
});

function checklist(ticked: number[] = []): ShoppingChecklistDto {
  const mark = (position: number) => ticked.includes(position);
  const legumbres = [item(1, 'Garbanzos cocidos', 400, 'g', mark(1)), item(2, 'Piñones', 20, 'g', mark(2), true)];
  const lacteos = [item(3, 'Leche', 1000, 'ml', mark(3))];
  const especias = [item(4, 'Comino', null, null, mark(4))];
  const count = (items: { checked: boolean }[]) => items.filter((i) => i.checked).length;
  return {
    menuNumber: 9101,
    startsOn: '2026-10-05',
    checkedCount: ticked.length,
    total: 4,
    categories: [
      { name: 'Legumbres', checkedCount: count(legumbres), items: legumbres },
      { name: 'Lácteos', checkedCount: count(lacteos), items: lacteos },
      { name: 'Especias', checkedCount: count(especias), items: especias },
    ],
  };
}

const answering = (message: string | null) =>
  vi.fn<(previous: CheckItemsState, form: FormData) => Promise<CheckItemsState>>(async (previous) => ({
    message,
    attempt: previous.attempt + 1,
  }));

const show = (ticked: number[] = [], view: 'all' | 'pending' = 'all', action = answering(null)) =>
  render(<ShoppingChecklist checklist={checklist(ticked)} view={view} action={action} />);

const progress = () => screen.getByRole('progressbar');

describe('ShoppingChecklist', () => {
  it('shows the menu, its Monday, and the categories and items in order', () => {
    show();

    expect(screen.getByText('Menú 9101')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Lista de la compra' })).toBeInTheDocument();
    expect(screen.getByText('Desde el lunes 5 de octubre')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Legumbres', 'Lácteos', 'Especias']);
    const rows = screen.getAllByRole('checkbox').map((box) => box.getAttribute('aria-label'));
    expect(rows).toEqual([
      'Marcar todos: Legumbres',
      'Garbanzos cocidos 400 g',
      'Piñones opcional 20 g',
      'Marcar todos: Lácteos',
      'Leche 1000 ml',
      'Marcar todos: Especias',
      'Comino',
    ]);
  });

  it('shows the progress over all the items', () => {
    show([1]);

    expect(screen.getByText('Marcados')).toBeInTheDocument();
    expect(progress()).toHaveAttribute('aria-valuetext', '1 de 4');
  });

  it('gives each category a toggle with done/total and true, false or mixed', () => {
    show([1, 3]);

    const legumbres = screen.getByRole('checkbox', { name: 'Marcar todos: Legumbres' });
    expect(legumbres).toHaveAttribute('aria-checked', 'mixed');
    expect(legumbres).toHaveTextContent('1/2');
    expect(screen.getByRole('checkbox', { name: 'Marcar todos: Lácteos' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('checkbox', { name: 'Marcar todos: Especias' })).toHaveAttribute('aria-checked', 'false');
  });

  it('posts every position of the category: ticks all when not all are ticked, unticks all when they are', () => {
    const { rerender } = show([1]);
    const formOf = (name: string) => screen.getByRole('checkbox', { name }).closest('form') as HTMLFormElement;

    const ticking = new FormData(formOf('Marcar todos: Legumbres'));
    expect(ticking.getAll('position')).toEqual(['1', '2']);
    expect(ticking.get('menuNumber')).toBe('9101');
    expect(ticking.get('checked')).toBe('true');

    rerender(<ShoppingChecklist checklist={checklist([1, 2])} view="all" action={answering(null)} />);
    expect(new FormData(formOf('Marcar todos: Legumbres')).get('checked')).toBe('false');
  });

  it('offers the two views as links and marks the active one', () => {
    show([], 'pending');

    expect(screen.getByRole('link', { name: 'Todo' })).toHaveAttribute('href', '/shopping-list');
    expect(screen.getByRole('link', { name: 'Por comprar' })).toHaveAttribute('href', '/shopping-list?vista=por-comprar');
    expect(screen.getByRole('link', { name: 'Por comprar' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Todo' })).not.toHaveAttribute('aria-current');
  });

  it('hides the ticked items and the categories fully ticked in "Por comprar", and still counts them', () => {
    show([1, 3], 'pending');

    expect(screen.queryByRole('checkbox', { name: /Garbanzos/ })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Piñones/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Lácteos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Leche/ })).not.toBeInTheDocument();
    expect(progress()).toHaveAttribute('aria-valuetext', '2 de 4');
  });

  it('shows a tick at once and sends it to the action', async () => {
    const action = answering(null);
    show([], 'all', action);

    fireEvent.click(screen.getByRole('checkbox', { name: /Garbanzos/ }));

    await vi.waitFor(() => expect(screen.getByRole('checkbox', { name: /Garbanzos/ })).toHaveAttribute('aria-checked', 'true'));
    expect(progress()).toHaveAttribute('aria-valuetext', '1 de 4');
    expect(screen.getByRole('checkbox', { name: 'Marcar todos: Legumbres' })).toHaveTextContent('1/2');
    await vi.waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const form = action.mock.calls[0]![1];
    expect([form.get('menuNumber'), form.getAll('position'), form.get('checked')]).toEqual(['9101', ['1'], 'true']);
  });

  it('has no alert before a failure, then announces the message and announces a repeat again', async () => {
    const action = answering('No se ha podido guardar. Inténtalo de nuevo.');
    show([], 'all', action);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /Leche/ }));
    const first = await screen.findByRole('alert');
    expect(first).toHaveTextContent('No se ha podido guardar. Inténtalo de nuevo.');

    fireEvent.click(screen.getByRole('checkbox', { name: /Leche/ }));
    await vi.waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(screen.getByRole('alert')).not.toBe(first));
  });
});
