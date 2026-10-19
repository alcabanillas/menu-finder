import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WeeksToChooseDto } from '@/application/dto/weeks-to-choose';
import type { ChoiceState } from '@/features/menu-planner/choice-view';
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
    onlyExclusions: false,
    chips: [
      { kind: 'constraint', members: [member('garbanzos')] },
      { kind: 'constraint', members: [member('cerdo', { polarity: 'exclude', type: 'exclusion' })] },
    ],
    cards: menus.map((menu, index) => ({
      rank: index + 1,
      menu,
      summary: 'Cumple las 2 cosas que pides.',
      lines: [
        { kind: 'constraint', terms: [member('garbanzos')], state: 'met', detail: 'Martes, comida · Garbanzos con espinacas' },
        { kind: 'constraint', terms: [member('cerdo', { polarity: 'exclude' })], state: 'met', detail: 'no aparece en la semana' },
      ],
    })),
  };
}

const EMPTY_WEEKS: WeeksToChooseDto = {
  current: { startsOn: '2026-10-05', endsOn: '2026-10-11', menuNumber: null, locked: false },
  next: { startsOn: '2026-10-12', endsOn: '2026-10-18', menuNumber: null, locked: false },
  suggested: 'current',
};

type ChooseAction = (previous: ChoiceState, formData: FormData) => Promise<ChoiceState>;

function choosing(...states: ChoiceState[]) {
  const queue = [...states];
  return vi.fn<ChooseAction>(async () => queue.shift() as ChoiceState);
}

type PlannerProps = Partial<Parameters<typeof PlannerSearch>[0]>;

function Planner({ action = answering(), chooseAction = choosing(), weeks = EMPTY_WEEKS, initialWeek }: PlannerProps) {
  return <PlannerSearch action={action} chooseAction={chooseAction} weeks={weeks} initialWeek={initialWeek} />;
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
    render(<Planner action={answering()} />);

    const box = screen.getByRole('textbox');
    expect(box).toHaveAttribute('placeholder', '¿Qué te apetece?');
    expect(box).toHaveAttribute('name', 'request');
    expect(screen.getByRole('button', { name: 'Buscar' })).toHaveAttribute('type', 'submit');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('keeps the search box under the header of the shell when the page scrolls: it sticks at the height of the header', () => {
    render(<Planner />);

    const row = screen.getByRole('textbox').closest('form')?.parentElement as HTMLElement;
    // The header is `sticky top-0` and 56 px high, 64 px from 640 px; at `top-0` the box would hide behind it.
    expect(row).toHaveClass('sticky', 'top-14', 'sm:top-16');
    expect(row).not.toHaveClass('top-0');
  });

  it('posts the form to the server action itself, not as a GET: the text never reaches the URL', async () => {
    const action = answering(ranking(1));
    render(<Planner action={action} />);
    const form = screen.getByRole('textbox').closest('form') as HTMLFormElement;

    expect(form).not.toHaveAttribute('method', 'get');

    await search('garbanzos sin cerdo');

    expect(action).toHaveBeenCalledOnce();
    expect(action.mock.calls[0][1].get('request')).toBe('garbanzos sin cerdo');
    expect(window.location.search).toBe('');
  });

  it('shows the chips and the cards of a ranking', async () => {
    render(<Planner action={answering(ranking(1))} />);

    await search('garbanzos sin cerdo');

    const chips = within(await screen.findByRole('list', { name: 'Lo que has pedido' })).getAllByRole('listitem');
    expect(chips).toHaveLength(2);
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByText('Menú 12')).toBeInTheDocument();
  });

  it('shows the heading "Ningún menú encaja con lo que has pedido" under the chips when the ranking is empty', async () => {
    render(<Planner action={answering(ranking(1, []))} />);

    await search('garbanzos');

    expect(await screen.findByRole('heading', { level: 2, name: 'Ningún menú encaja con lo que has pedido' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Resultados' })).not.toBeInTheDocument();
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
    render(<Planner action={answering(failed)} />);

    await search('   ');

    expect(await screen.findByRole('alert')).toHaveTextContent('Escribe qué te apetece.');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('says it is searching and disables the button while the answer has not arrived', async () => {
    let answer: (state: PlannerSearchState) => void = () => {};
    const pending = vi.fn(() => new Promise<PlannerSearchState>((resolve) => (answer = resolve)));
    render(<Planner action={pending} />);

    await search('garbanzos');

    expect(await screen.findByText('Buscando…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeDisabled();

    // The answer arrives, so that the transition does not stay open for the tests that follow.
    await act(async () => answer(ranking(1)));
    expect(screen.queryByText('Buscando…')).not.toBeInTheDocument();
  });

  it('heads the cards with "Resultados" and the real count', async () => {
    render(<Planner action={answering(ranking(1, [12, 3, 20]))} />);

    await search('garbanzos sin cerdo');

    expect(await screen.findByRole('heading', { level: 2, name: 'Resultados' })).toBeInTheDocument();
    expect(screen.getByText('Los 3 que mejor encajan')).toBeInTheDocument();
  });

  it('says "El que mejor encaja" for one menu', async () => {
    render(<Planner action={answering(ranking(1, [12]))} />);

    await search('garbanzos sin cerdo');

    expect(await screen.findByText('El que mejor encaja')).toBeInTheDocument();
  });

  it('explains the tie of a request with only week-wide exclusions, with no rank on the cards', async () => {
    const only: PlannerSearchState = {
      status: 'ranking',
      attempt: 1,
      onlyExclusions: true,
      chips: [{ kind: 'constraint', members: [member('cerdo', { polarity: 'exclude', type: 'exclusion' })] }],
      cards: [4, 9].map((menu) => ({
        rank: null,
        menu,
        summary: null,
        lines: [{ kind: 'constraint', terms: [member('cerdo', { polarity: 'exclude' })], state: 'met', detail: 'no aparece en la semana' }],
      })),
    };
    render(<Planner action={answering(only)} />);

    await search('nada de cerdo');

    expect(await screen.findByText('Todos cumplen lo que pides')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Resultados' })).toBeInTheDocument();
    expect(
      screen.getByText('Como solo has pedido quitar cosas, todos estos menús lo cumplen por igual: salen por número de menú.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/mejor encaja/)).not.toBeInTheDocument();
  });

  it('replaces the chips and the cards of the previous search with the new ones', async () => {
    const second: PlannerSearchState = {
      status: 'ranking',
      attempt: 2,
      onlyExclusions: false,
      chips: [{ kind: 'constraint', members: [member('lentejas')] }],
      cards: [{ rank: 1, menu: 7, summary: 'Cumple lo que pides.', lines: [{ kind: 'constraint', terms: [member('lentejas')], state: 'met', detail: 'Lunes, comida · Lentejas' }] }],
    };
    render(<Planner action={answering(ranking(1), second)} />);

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
    render(<Planner action={action} />);
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
      render(<Planner action={answering()} />);

      const box = screen.getByRole('textbox');
      expect(box).toBeRequired();
      expect(box).not.toHaveAttribute('maxlength');
    });

    it('when empty, is not sent: no search and no breadcrumb', async () => {
      const action = answering();
      render(<Planner action={action} />);

      await search('');

      expect(action).not.toHaveBeenCalled();
      expect(sentry.addBreadcrumb).not.toHaveBeenCalled();
    });

    it('with only spaces, is sent: the server answers it', async () => {
      const action = answering({ status: 'failed', kind: 'request-too-short', message: 'Escribe qué te apetece.', attempt: 1 });
      render(<Planner action={action} />);

      await search('   ');

      expect(action).toHaveBeenCalledOnce();
      expect(await screen.findByRole('alert')).toHaveTextContent('Escribe qué te apetece.');
    });
  });

  describe('breadcrumbs', () => {
    it('adds one when the form is sent and one when a ranking arrives, with counts only', async () => {
      render(<Planner action={answering(ranking(1, [1, 2, 3, 4, 5]))} />);

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
      render(<Planner action={answering(failed)} />);

      await search('garbanzos');
      await screen.findByRole('alert');

      expect(sentry.addBreadcrumb).toHaveBeenLastCalledWith({
        category: 'planner',
        message: 'search answered',
        data: { outcome: 'llm-limit-reached', chips: 0, menus: 0 },
      });
    });
  });

  describe('choosing a menu', () => {
    const THIS_WEEK_CHOSEN: WeeksToChooseDto = {
      current: { ...EMPTY_WEEKS.current, menuNumber: 14 },
      next: EMPTY_WEEKS.next,
      suggested: 'next',
    };
    const CHOSEN_NEXT: ChoiceState = {
      status: 'chosen',
      menu: 3,
      week: 'next',
      message: 'Menú 3 para la semana del 12 oct.',
      weekHref: '/menu?startsOn=2026-10-12',
      attempt: 1,
    };
    const LOCKED_FAILURE: ChoiceState = {
      status: 'failed',
      kind: 'week-locked',
      message: 'Esta semana ya no se puede cambiar: ya has elegido la de la semana que viene.',
      attempt: 1,
    };

    async function renderRanking(props: PlannerProps = {}, menus: number[] = [12, 3]) {
      const view = render(<Planner action={answering(ranking(1, menus))} {...props} />);
      await search('garbanzos');
      await screen.findAllByRole('article');
      return view;
    }

    const chooseButtons = () => screen.getAllByRole('button', { name: /\(Menú \d+\)$/ });

    async function choose(name: string) {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name }));
      });
    }

    it('puts the week selector above the search box and links it to an empty choose form', () => {
      render(<Planner />);

      const selector = screen.getByRole('group', { name: 'Eligiendo menú para' });
      const box = screen.getByRole('textbox');
      expect(selector.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      const radio = screen.getAllByRole('radio')[0] as HTMLInputElement;
      expect(radio.form).not.toBeNull();
      expect(radio.form).not.toBe(box.closest('form'));
      expect(radio.form?.children).toHaveLength(0);
    });

    it('hides the empty choose form, so that it adds no gap above the selector', () => {
      render(<Planner />);

      const form = (screen.getAllByRole('radio')[0] as HTMLInputElement).form as HTMLFormElement;
      expect(form).toHaveClass('hidden');
      expect(form.nextElementSibling).toBe(screen.getByRole('group', { name: 'Eligiendo menú para' }));
    });

    it('starts on the suggested week', () => {
      render(<Planner weeks={THIS_WEEK_CHOSEN} />);

      expect(screen.getByRole('radio', { name: /La que viene/ })).toBeChecked();
    });

    it('names the week on each button, joined to the choose form and posting the menu', async () => {
      await renderRanking();

      const buttons = chooseButtons();
      expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
        'Elegir para el 5 oct (Menú 12)',
        'Elegir para el 5 oct (Menú 3)',
      ]);
      const form = (screen.getAllByRole('radio')[0] as HTMLInputElement).form;
      for (const button of buttons) {
        expect((button as HTMLButtonElement).form).toBe(form);
        expect(button).toHaveAttribute('name', 'menu');
      }
    });

    it('changes the buttons with the selected week and runs no new search', async () => {
      const searchAction = answering(ranking(1));
      await renderRanking({ action: searchAction });

      fireEvent.click(screen.getByRole('radio', { name: /La que viene/ }));

      expect(chooseButtons().map((button) => button.getAttribute('aria-label'))).toEqual([
        'Elegir para el 12 oct (Menú 12)',
        'Elegir para el 12 oct (Menú 3)',
      ]);
      expect(searchAction).toHaveBeenCalledOnce();
    });

    it('shows the card of the week’s menu as selected, and the others as changes', async () => {
      await renderRanking({ weeks: THIS_WEEK_CHOSEN }, [14, 3]);
      fireEvent.click(screen.getByRole('radio', { name: /Esta semana/ }));

      const selected = screen.getByRole('button', { name: 'Menú del 5 oct (Menú 14)' });
      expect(selected).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cambiar el menú del 5 oct (Menú 3)' })).toBeEnabled();
    });

    it('shows the card of the other week like the rest once the selector changes', async () => {
      await renderRanking({ weeks: THIS_WEEK_CHOSEN }, [14, 3]);
      fireEvent.click(screen.getByRole('radio', { name: /Esta semana/ }));

      fireEvent.click(screen.getByRole('radio', { name: /La que viene/ }));

      expect(screen.getByRole('button', { name: 'Elegir para el 12 oct (Menú 14)' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Elegir para el 12 oct (Menú 3)' })).toBeEnabled();
    });

    it('moves to next week when the selected week becomes locked, as after the random button', () => {
      const view = render(<Planner />);
      expect(screen.getByRole('radio', { name: /Esta semana/ })).toBeChecked();

      view.rerender(
        <Planner
          weeks={{
            current: { ...EMPTY_WEEKS.current, menuNumber: 3, locked: true },
            next: { ...EMPTY_WEEKS.next, menuNumber: 12 },
            suggested: 'next',
          }}
        />,
      );

      expect(screen.getByRole('radio', { name: /La que viene/ })).toBeChecked();
      expect(screen.getByRole('radio', { name: /Esta semana/ })).not.toBeChecked();
    });

    it('starts on the week asked for, unless it is locked', () => {
      const locked: WeeksToChooseDto = {
        current: { ...EMPTY_WEEKS.current, menuNumber: 3, locked: true },
        next: { ...EMPTY_WEEKS.next, menuNumber: 12 },
        suggested: 'next',
      };
      const { unmount } = render(<Planner weeks={EMPTY_WEEKS} initialWeek="next" />);
      expect(screen.getByRole('radio', { name: /La que viene/ })).toBeChecked();
      unmount();

      render(<Planner weeks={locked} initialWeek="current" />);
      expect(screen.getByRole('radio', { name: /La que viene/ })).toBeChecked();
    });

    describe('the random button', () => {
      const randomButtons = () => screen.getAllByRole('button', { name: 'Elegir uno al azar' });

      it('is a secondary button with a dice, once for a phone and once for a desktop, joined to the choose form', () => {
        render(<Planner />);

        expect(randomButtons()).toHaveLength(2);
        const form = (screen.getAllByRole('radio')[0] as HTMLInputElement).form;
        for (const button of randomButtons()) {
          expect(button).toHaveAttribute('type', 'submit');
          expect(button).toHaveAttribute('name', 'random');
          expect(button).toHaveAttribute('value', '1');
          expect((button as HTMLButtonElement).form).toBe(form);
          expect(button).toHaveClass('border-border-ink');
          expect(button.querySelector('svg[data-icon="dices"]')).toBeInTheDocument();
        }
        expect(screen.queryByRole('button', { name: 'Elegir un menú al azar' })).not.toBeInTheDocument();
      });

      it('sits outside the search form, so that it never sends a search', () => {
        render(<Planner />);

        const searchForm = screen.getByRole('textbox').closest('form');
        for (const button of randomButtons()) expect(searchForm?.contains(button) && (button as HTMLButtonElement).form === searchForm).toBe(false);
      });

      it('chooses for the selected week at once when it is empty', async () => {
        const chooseAction = choosing(CHOSEN_NEXT);
        render(<Planner chooseAction={chooseAction} />);
        fireEvent.click(screen.getByRole('radio', { name: /La que viene/ }));

        await act(async () => {
          fireEvent.click(randomButtons()[0]);
        });

        expect(chooseAction).toHaveBeenCalledOnce();
        const form = chooseAction.mock.calls[0][1];
        expect(form.get('random')).toBe('1');
        expect(form.get('week')).toBe('next');
        expect(await screen.findByText('Menú 3 para la semana del 12 oct.')).toBeInTheDocument();
      });

      it('asks before replacing the menu of the selected week, and Cambiar posts', async () => {
        const chooseAction = choosing(CHOSEN_NEXT);
        render(<Planner weeks={THIS_WEEK_CHOSEN} chooseAction={chooseAction} />);
        fireEvent.click(screen.getByRole('radio', { name: /Esta semana/ }));

        fireEvent.click(randomButtons()[0]);

        expect(chooseAction).not.toHaveBeenCalled();
        expect(screen.getByRole('group', { name: 'Confirmar cambio' })).toHaveTextContent(
          '¿Cambiar el Menú 14 por uno al azar en la semana del 5 oct?',
        );
        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Cambiar' }));
        });
        const form = chooseAction.mock.calls[0][1];
        expect(form.get('random')).toBe('1');
        expect(form.get('week')).toBe('current');
        expect(screen.queryByRole('group', { name: 'Confirmar cambio' })).not.toBeInTheDocument();
      });

      it('closes the question with Cancelar and posts nothing', () => {
        const chooseAction = choosing();
        render(<Planner weeks={THIS_WEEK_CHOSEN} chooseAction={chooseAction} />);
        fireEvent.click(screen.getByRole('radio', { name: /Esta semana/ }));
        fireEvent.click(randomButtons()[0]);

        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

        expect(screen.queryByRole('group', { name: 'Confirmar cambio' })).not.toBeInTheDocument();
        expect(chooseAction).not.toHaveBeenCalled();
      });
    });

    describe('replacing from a card', () => {
      it('asks inside that card only, and Cambiar posts the menu of the card', async () => {
        const chooseAction = choosing(CHOSEN_NEXT);
        await renderRanking({ weeks: THIS_WEEK_CHOSEN, chooseAction }, [14, 3]);
        fireEvent.click(screen.getByRole('radio', { name: /Esta semana/ }));

        fireEvent.click(screen.getByRole('button', { name: 'Cambiar el menú del 5 oct (Menú 3)' }));

        const box = screen.getByRole('group', { name: 'Confirmar cambio' });
        expect(box).toHaveTextContent('¿Cambiar el Menú 14 por el Menú 3 en la semana del 5 oct?');
        expect(box.closest('article')).toHaveTextContent('Menú 3');
        expect(screen.getAllByRole('group', { name: 'Confirmar cambio' })).toHaveLength(1);
        expect(chooseAction).not.toHaveBeenCalled();
        await act(async () => {
          fireEvent.click(within(box).getByRole('button', { name: 'Cambiar' }));
        });
        expect(chooseAction.mock.calls[0][1].get('menu')).toBe('3');
        expect(chooseAction.mock.calls[0][1].get('week')).toBe('current');
      });

      it('goes back to the buttons with Cancelar, and when another week is selected', async () => {
        await renderRanking({ weeks: THIS_WEEK_CHOSEN }, [14, 3]);
        fireEvent.click(screen.getByRole('radio', { name: /Esta semana/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Cambiar el menú del 5 oct (Menú 3)' }));

        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(screen.getByRole('button', { name: 'Cambiar el menú del 5 oct (Menú 3)' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Cambiar el menú del 5 oct (Menú 3)' }));
        fireEvent.click(screen.getByRole('radio', { name: /La que viene/ }));
        expect(screen.queryByRole('group', { name: 'Confirmar cambio' })).not.toBeInTheDocument();
      });

      it('asks for nothing when the week is empty: the button chooses at once', async () => {
        const chooseAction = choosing(CHOSEN_NEXT);
        await renderRanking({ chooseAction });

        await choose('Elegir para el 5 oct (Menú 3)');

        expect(chooseAction).toHaveBeenCalledOnce();
      });
    });

    it('sends the menu and the week to the choose action', async () => {
      const chooseAction = choosing(CHOSEN_NEXT);
      await renderRanking({ chooseAction });
      fireEvent.click(screen.getByRole('radio', { name: /La que viene/ }));

      await choose('Elegir para el 12 oct (Menú 3)');

      expect(chooseAction).toHaveBeenCalledOnce();
      const form = chooseAction.mock.calls[0][1];
      expect(form.get('week')).toBe('next');
      expect(form.get('menu')).toBe('3');
    });

    it('keeps the selected week checked after a choice, although the form resets when its action ends', async () => {
      await renderRanking({ chooseAction: choosing(CHOSEN_NEXT) });
      fireEvent.click(screen.getByRole('radio', { name: /La que viene/ }));

      await choose('Elegir para el 12 oct (Menú 3)');
      await screen.findByText('Menú 3 para la semana del 12 oct.');

      expect(screen.getByRole('radio', { name: /La que viene/ })).toBeChecked();
      expect(screen.getByRole('radio', { name: /Esta semana/ })).not.toBeChecked();
    });

    it('keeps the chips and the cards after choosing, and says where the menu went', async () => {
      const view = await renderRanking({ chooseAction: choosing(CHOSEN_NEXT) });
      fireEvent.click(screen.getByRole('radio', { name: /La que viene/ }));

      await choose('Elegir para el 12 oct (Menú 3)');

      expect(await screen.findByText('Menú 3 para la semana del 12 oct.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Ver semana/ })).toHaveAttribute('href', '/menu?startsOn=2026-10-12');
      expect(screen.getAllByRole('article')).toHaveLength(2);
      expect(screen.getByRole('list', { name: 'Lo que has pedido' })).toBeInTheDocument();
      view.rerender(<Planner weeks={{ ...EMPTY_WEEKS, next: { ...EMPTY_WEEKS.next, menuNumber: 3 } }} />);
      expect(screen.getByRole('button', { name: 'Menú del 12 oct (Menú 3)' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cambiar el menú del 12 oct (Menú 12)' })).toBeEnabled();
    });

    it('says it is choosing and disables every choose button while the answer has not arrived', async () => {
      let answer: (state: ChoiceState) => void = () => {};
      const chooseAction = vi.fn<ChooseAction>(() => new Promise<ChoiceState>((resolve) => (answer = resolve)));
      await renderRanking({ chooseAction });

      await choose('Elegir para el 5 oct (Menú 3)');

      expect(await screen.findByText('Eligiendo…')).toBeInTheDocument();
      for (const button of chooseButtons()) expect(button).toBeDisabled();

      await act(async () => answer(CHOSEN_NEXT));
      expect(screen.queryByText('Eligiendo…')).not.toBeInTheDocument();
    });

    it('clears the message of the choice on a new search', async () => {
      await renderRanking({ action: answering(ranking(1), ranking(2)), chooseAction: choosing(CHOSEN_NEXT) });
      await choose('Elegir para el 5 oct (Menú 3)');
      await screen.findByText('Menú 3 para la semana del 12 oct.');

      await search('lentejas');

      await waitFor(() => expect(screen.queryByText('Menú 3 para la semana del 12 oct.')).not.toBeInTheDocument());
    });

    it('clears the message of the choice when another week is selected', async () => {
      await renderRanking({ chooseAction: choosing(CHOSEN_NEXT) });
      await choose('Elegir para el 5 oct (Menú 3)');
      await screen.findByText('Menú 3 para la semana del 12 oct.');

      fireEvent.click(screen.getByRole('radio', { name: /La que viene/ }));

      expect(screen.queryByText('Menú 3 para la semana del 12 oct.')).not.toBeInTheDocument();
    });

    it.each([
      ['invalid-menu', 'Ese menú no existe.'],
      ['invalid-week', 'Esa semana no se puede elegir.'],
      ['week-locked', 'Esta semana ya no se puede cambiar: ya has elegido la de la semana que viene.'],
      ['failed', 'No se ha podido elegir el menú. Inténtalo de nuevo.'],
    ] as const)('shows the failure %s as an alert and keeps the results', async (kind, message) => {
      await renderRanking({ chooseAction: choosing({ status: 'failed', kind, message, attempt: 1 }) });

      await choose('Elegir para el 5 oct (Menú 3)');

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(screen.getAllByRole('article')).toHaveLength(2);
      expect(screen.getByRole('list', { name: 'Lo que has pedido' })).toBeInTheDocument();
    });

    it('shows the cards with no button when the weeks cannot be read', async () => {
      await renderRanking({ weeks: null });

      expect(screen.getByText('No se ha podido cargar tu menú.')).toBeInTheDocument();
      expect(screen.getAllByRole('article')).toHaveLength(2);
      expect(screen.queryByRole('button', { name: /\(Menú \d+\)$/ })).not.toBeInTheDocument();
    });

    it('adds a breadcrumb when a menu is chosen and one when the answer arrives, with the week and the outcome only', async () => {
      await renderRanking({ chooseAction: choosing(CHOSEN_NEXT) });
      sentry.addBreadcrumb.mockClear();
      fireEvent.click(screen.getByRole('radio', { name: /La que viene/ }));

      await choose('Elegir para el 12 oct (Menú 3)');
      await screen.findByText('Menú 3 para la semana del 12 oct.');

      expect(sentry.addBreadcrumb.mock.calls.map(([crumb]) => crumb)).toEqual([
        { category: 'planner', message: 'menu chosen', data: { week: 'next' } },
        { category: 'planner', message: 'choice answered', data: { outcome: 'chosen', week: 'next' } },
      ]);
      const everything = JSON.stringify(sentry.addBreadcrumb.mock.calls);
      for (const forbidden of ['garbanzos', 'Garbanzos con espinacas', 'Menú 3']) expect(everything).not.toContain(forbidden);
    });

    it('records the kind of a refused choice as its outcome', async () => {
      await renderRanking({ chooseAction: choosing(LOCKED_FAILURE) });
      sentry.addBreadcrumb.mockClear();

      await choose('Elegir para el 5 oct (Menú 3)');
      await screen.findByRole('alert');

      expect(sentry.addBreadcrumb).toHaveBeenLastCalledWith({
        category: 'planner',
        message: 'choice answered',
        data: { outcome: 'week-locked', week: 'current' },
      });
    });
  });
});
