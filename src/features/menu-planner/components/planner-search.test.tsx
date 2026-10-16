import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlannerSearch } from '@/features/menu-planner/components/planner-search';
import type { ChipMember, PlannerSearchState } from '@/features/menu-planner/search-view';

const sentry = vi.hoisted(() => ({ addBreadcrumb: vi.fn() }));
vi.mock('@sentry/nextjs', () => sentry);

afterEach(() => {
  vi.clearAllMocks();
});

function member(term: string, overrides: Partial<ChipMember> = {}): ChipMember {
  return { term, polarity: 'include', type: 'literal', hard: false, slot: undefined, ...overrides };
}

function ranking(attempt: number, menus: number[] = [12, 3]): PlannerSearchState {
  return {
    status: 'ranking',
    attempt,
    chips: [
      { kind: 'constraint', members: [member('garbanzos')] },
      { kind: 'constraint', members: [member('cerdo', { polarity: 'exclude', type: 'exclusion' })] },
    ],
    cards: menus.map((menu, index) => ({
      rank: index + 1,
      menu,
      lines: [
        { kind: 'constraint', terms: [member('garbanzos')], found: true, detail: 'Martes, comida · Garbanzos con espinacas' },
        { kind: 'constraint', terms: [member('cerdo', { polarity: 'exclude' })], found: true, detail: 'no aparece en la semana' },
      ],
    })),
  };
}

function answering(...states: PlannerSearchState[]) {
  const queue = [...states];
  return vi.fn(async (...args: [PlannerSearchState, FormData]) => (args.length > 0 ? queue.shift() : undefined) as PlannerSearchState);
}

async function search(text: string) {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  });
}

describe('PlannerSearch', () => {
  it('has the search box with its placeholder and the field "request", and shows nothing under it at first', () => {
    render(<PlannerSearch action={answering()} />);

    const box = screen.getByRole('textbox');
    expect(box).toHaveAttribute('placeholder', '¿Qué te apetece esta semana?');
    expect(box).toHaveAttribute('name', 'request');
    expect(screen.getByRole('button', { name: 'Buscar' })).toHaveAttribute('type', 'submit');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('posts the form to the server action itself, not as a GET: the text never reaches the URL', async () => {
    const action = answering(ranking(1));
    render(<PlannerSearch action={action} />);
    const form = screen.getByRole('textbox').closest('form') as HTMLFormElement;

    expect(form).not.toHaveAttribute('method', 'get');

    await search('garbanzos sin cerdo');

    expect(action).toHaveBeenCalledOnce();
    expect(action.mock.calls[0][1].get('request')).toBe('garbanzos sin cerdo');
    expect(window.location.search).toBe('');
  });

  it('shows the chips and the cards of a ranking', async () => {
    render(<PlannerSearch action={answering(ranking(1))} />);

    await search('garbanzos sin cerdo');

    const chips = within(await screen.findByRole('list', { name: 'Lo que has pedido' })).getAllByRole('listitem');
    expect(chips).toHaveLength(2);
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByText('Menú 12')).toBeInTheDocument();
  });

  it('says "Ningún menú encaja con lo que has pedido." under the chips when the ranking is empty', async () => {
    render(<PlannerSearch action={answering(ranking(1, []))} />);

    await search('garbanzos');

    expect(await screen.findByText('Ningún menú encaja con lo que has pedido.')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Lo que has pedido' })).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('shows the message of a failed search as an alert, with no chips or cards', async () => {
    const failed: PlannerSearchState = {
      status: 'failed',
      kind: 'request-too-short',
      message: 'Escribe qué te apetece.',
      attempt: 1,
    };
    render(<PlannerSearch action={answering(failed)} />);

    await search('   ');

    expect(await screen.findByRole('alert')).toHaveTextContent('Escribe qué te apetece.');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('says it is searching and disables the button while the answer has not arrived', async () => {
    let answer: (state: PlannerSearchState) => void = () => {};
    const pending = vi.fn(() => new Promise<PlannerSearchState>((resolve) => (answer = resolve)));
    render(<PlannerSearch action={pending} />);

    await search('garbanzos');

    expect(await screen.findByText('Buscando…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeDisabled();

    // The answer arrives, so that the transition does not stay open for the tests that follow.
    await act(async () => answer(ranking(1)));
    expect(screen.queryByText('Buscando…')).not.toBeInTheDocument();
  });

  it('replaces the chips and the cards of the previous search with the new ones', async () => {
    const second: PlannerSearchState = {
      status: 'ranking',
      attempt: 2,
      chips: [{ kind: 'constraint', members: [member('lentejas')] }],
      cards: [{ rank: 1, menu: 7, lines: [{ kind: 'constraint', terms: [member('lentejas')], found: true, detail: 'Lunes, comida · Lentejas' }] }],
    };
    render(<PlannerSearch action={answering(ranking(1), second)} />);

    await search('garbanzos');
    await screen.findByText('Menú 12');
    await search('lentejas');

    await waitFor(() => expect(screen.queryByText('Menú 12')).not.toBeInTheDocument());
    expect(screen.getByText('Menú 7')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Lo que has pedido' })).getAllByRole('listitem')).toHaveLength(1);
  });

  it('hides the chips and the cards of the previous search while the new one runs', async () => {
    let answer: (state: PlannerSearchState) => void = () => {};
    const action = vi
      .fn<(previous: PlannerSearchState, form: FormData) => Promise<PlannerSearchState>>()
      .mockResolvedValueOnce(ranking(1))
      .mockImplementationOnce(() => new Promise<PlannerSearchState>((resolve) => (answer = resolve)));
    render(<PlannerSearch action={action} />);
    await search('garbanzos');
    await screen.findByText('Menú 12');

    await search('lentejas');

    expect(await screen.findByText('Buscando…')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Lo que has pedido' })).not.toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();

    await act(async () => answer(ranking(2, [7])));
    expect(screen.getByText('Menú 7')).toBeInTheDocument();
  });

  describe('the box', () => {
    it('is required and does not cut the text: the server checks the length', () => {
      render(<PlannerSearch action={answering()} />);

      const box = screen.getByRole('textbox');
      expect(box).toBeRequired();
      expect(box).not.toHaveAttribute('maxlength');
    });

    it('when empty, is not sent: no search and no breadcrumb', async () => {
      const action = answering();
      render(<PlannerSearch action={action} />);

      await search('');

      expect(action).not.toHaveBeenCalled();
      expect(sentry.addBreadcrumb).not.toHaveBeenCalled();
    });

    it('with only spaces, is sent: the server answers it', async () => {
      const action = answering({ status: 'failed', kind: 'request-too-short', message: 'Escribe qué te apetece.', attempt: 1 });
      render(<PlannerSearch action={action} />);

      await search('   ');

      expect(action).toHaveBeenCalledOnce();
      expect(await screen.findByRole('alert')).toHaveTextContent('Escribe qué te apetece.');
    });
  });

  describe('breadcrumbs', () => {
    it('adds one when the form is sent and one when a ranking arrives, with counts only', async () => {
      render(<PlannerSearch action={answering(ranking(1, [1, 2, 3, 4, 5]))} />);

      await search('garbanzos sin cerdo');
      await screen.findByText('Menú 5');

      expect(sentry.addBreadcrumb.mock.calls.map(([crumb]) => crumb)).toEqual([
        { category: 'planner', message: 'search sent' },
        { category: 'planner', message: 'search answered', data: { outcome: 'ranking', chips: 2, menus: 5 } },
      ]);
      const everything = JSON.stringify(sentry.addBreadcrumb.mock.calls);
      for (const forbidden of ['garbanzos', 'cerdo', 'Garbanzos con espinacas']) expect(everything).not.toContain(forbidden);
    });

    it('records the kind of a failed search as its outcome, with no chips or menus', async () => {
      const failed: PlannerSearchState = {
        status: 'failed',
        kind: 'llm-limit-reached',
        message: 'Hoy ya no se pueden hacer más búsquedas. Vuelve a intentarlo mañana.',
        attempt: 1,
      };
      render(<PlannerSearch action={answering(failed)} />);

      await search('garbanzos');
      await screen.findByRole('alert');

      expect(sentry.addBreadcrumb).toHaveBeenLastCalledWith({
        category: 'planner',
        message: 'search answered',
        data: { outcome: 'llm-limit-reached', chips: 0, menus: 0 },
      });
    });
  });
});
