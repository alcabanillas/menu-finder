import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MenuCandidateCard } from '@/features/menu-planner/components/menu-candidate-card';
import type { CardChoice } from '@/features/menu-planner/components/menu-candidate-card';
import type { CandidateCard, ChipMember, EvidenceLine } from '@/features/menu-planner/search-view';

function member(term: string, overrides: Partial<ChipMember> = {}): ChipMember {
  return { term, polarity: 'include', type: 'literal', hard: false, slot: undefined, ...overrides };
}

const CARD: CandidateCard = {
  rank: 2,
  menu: 12,
  summary: 'Cumple las 2 cosas que pides.',
  lines: [
    { kind: 'constraint', terms: [member('garbanzos')], state: 'met', detail: 'Martes, comida · Garbanzos con espinacas' },
    { kind: 'constraint', terms: [member('cerdo', { polarity: 'exclude', type: 'exclusion' })], state: 'met', detail: 'no aparece en la semana' },
    { kind: 'constraint', terms: [member('salmón')], state: 'unmet', detail: 'ningún plato' },
    { kind: 'constraint', terms: [member('sencillas', { type: 'attribute' })], state: 'met', detail: 'Lunes, cena · Crema' },
  ],
};

function lines(): HTMLElement[] {
  return within(screen.getByRole('article')).getAllByRole('listitem');
}

describe('MenuCandidateCard', () => {
  it('shows the rank, "Menú N" as the heading of the card with no badge, and the summary under it', () => {
    render(<MenuCandidateCard card={CARD} />);

    expect(screen.getByText('2')).toBeInTheDocument();
    const heading = screen.getByRole('heading', { level: 3, name: 'Menú 12' });
    expect(heading).not.toHaveClass('bg-ink');
    expect(screen.getByText('Cumple las 2 cosas que pides.')).toBeInTheDocument();
  });

  it('shows no rank and no summary when the request has only week-wide exclusions', () => {
    render(<MenuCandidateCard card={{ ...CARD, rank: null, summary: null }} />);

    expect(screen.queryByText('2')).not.toBeInTheDocument();
    expect(screen.queryByText(/Cumple/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Menú 12' })).toBeInTheDocument();
  });

  it('starts each line with its state, ✓ olive, ≈ ochre or ✕ terracotta, hidden from screen readers', () => {
    const similar: EvidenceLine = { kind: 'constraint', terms: [member('pescado al horno')], state: 'similar', detail: 'parecido: Jueves, cena · Merluza' };
    render(<MenuCandidateCard card={{ ...CARD, lines: [...CARD.lines, similar] }} />);

    const symbols = lines().map((line) => line.querySelector('[data-state]'));
    expect(symbols.map((symbol) => symbol?.textContent)).toEqual(['✓', '✓', '✕', '✓', '≈']);
    expect(symbols[0]).toHaveClass('text-olive-600');
    expect(symbols[2]).toHaveClass('text-terracotta-600');
    expect(symbols[4]).toHaveClass('text-ochre-700');
    expect(symbols.every((symbol) => symbol?.closest('[aria-hidden="true"]'))).toBe(true);
    expect(lines()[4]).toHaveTextContent('parecido: Jueves, cena · Merluza');
  });

  it('shows one line per unit with its terms and its detail', () => {
    render(<MenuCandidateCard card={CARD} />);

    expect(lines()).toHaveLength(4);
    expect(lines()[0]).toHaveTextContent('garbanzos');
    expect(lines()[0]).toHaveTextContent('Martes, comida · Garbanzos con espinacas');
    expect(lines()[1]).toHaveTextContent('no aparece en la semana');
  });

  it('colours the terms: olive for include and attribute, terracotta for exclude', () => {
    render(<MenuCandidateCard card={CARD} />);

    expect(within(lines()[0]).getByText('garbanzos')).toHaveClass('text-include');
    expect(within(lines()[1]).getByText('cerdo')).toHaveClass('text-exclude');
    expect(within(lines()[3]).getByText('sencillas')).toHaveClass('text-include');
  });

  it('separates the terms of a same-dish group with a rule and those of an any-of group with an "o"', () => {
    const card: CandidateCard = {
      rank: 1,
      menu: 3,
      summary: 'Cumple las 2 cosas que pides.',
      lines: [
        { kind: 'sameDish', terms: [member('arroz'), member('marisco', { polarity: 'exclude' })], state: 'met', detail: 'Lunes, comida · Arroz' },
        { kind: 'anyOf', terms: [member('lubina'), member('dorada')], state: 'met', detail: 'Martes, cena · Lubina' },
      ],
    };
    render(<MenuCandidateCard card={card} />);

    expect(lines()[0].querySelector('[data-separator="and"]')).toBeInTheDocument();
    expect(lines()[1].querySelector('[data-separator="or"]')).toHaveTextContent('o');
    expect(lines()[0].querySelector('[data-separator="or"]')).not.toBeInTheDocument();
  });

  it('puts the terms of a group that mixes include and exclude on an ochre background, like its chip', () => {
    const card: CandidateCard = {
      rank: 1,
      menu: 3,
      summary: 'Cumple las 2 cosas que pides.',
      lines: [
        { kind: 'sameDish', terms: [member('arroz'), member('marisco', { polarity: 'exclude' })], state: 'met', detail: 'Lunes, comida · Arroz' },
        { kind: 'sameDish', terms: [member('pollo'), member('verduras')], state: 'met', detail: 'Martes, cena · Pollo' },
        { kind: 'constraint', terms: [member('salmón')], state: 'unmet', detail: 'ningún plato' },
      ],
    };
    render(<MenuCandidateCard card={card} />);

    expect(lines()[0].querySelector('[data-terms]')).toHaveClass('bg-ochre-100');
    expect(lines()[1].querySelector('[data-terms]')).not.toHaveClass('bg-ochre-100');
    expect(lines()[2].querySelector('[data-terms]')).not.toHaveClass('bg-ochre-100');
  });

  it('renders a term and a dish name with HTML metacharacters as text, never as markup', () => {
    const card: CandidateCard = {
      rank: 1,
      menu: 3,
      summary: 'Cumple las 2 cosas que pides.',
      lines: [{ kind: 'constraint', terms: [member('<img src=x onerror=alert(1)>')], state: 'met', detail: 'Lunes, comida · <b>Arroz</b>' }],
    };
    render(<MenuCandidateCard card={card} />);

    expect(screen.getByRole('article').querySelector('img, b')).toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(screen.getByText('Lunes, comida · <b>Arroz</b>')).toBeInTheDocument();
  });

  it('has "Menú N" as its only heading, the summary as its only text besides the lines, and no button without the weeks', () => {
    render(<MenuCandidateCard card={CARD} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual(['Menú 12']);
    expect([...screen.getByRole('article').querySelectorAll('p')].map((p) => p.textContent)).toEqual(['Cumple las 2 cosas que pides.']);
  });

  describe('for a screen reader and without colour', () => {
    const GROUP: CandidateCard = {
      rank: 1,
      menu: 3,
      summary: 'Cumple las 2 cosas que pides.',
      lines: [
        {
          kind: 'sameDish',
          terms: [member('arroz'), member('marisco', { polarity: 'exclude', type: 'exclusion' })],
          state: 'met',
          detail: 'Martes, comida · Arroz con verduras',
        },
      ],
    };

    it('reads each line as the text of its chip and its detail, with the terms hidden', () => {
      render(<MenuCandidateCard card={GROUP} />);

      const line = lines()[0];
      expect(within(line).getByText(
        'En el mismo plato: arroz, preferencia y excluido: marisco, preferencia: Martes, comida · Arroz con verduras',
      )).toHaveClass('sr-only');
      expect(line.querySelector('[data-terms]')).toHaveAttribute('aria-hidden', 'true');
    });

    it('marks an excluded term with a minus, not only with colour', () => {
      render(<MenuCandidateCard card={GROUP} />);

      const terms = lines()[0].querySelector('[data-terms]') as HTMLElement;
      expect(terms.querySelectorAll('svg[data-icon="minus"]')).toHaveLength(1);
      expect(within(terms).getByText('marisco').previousElementSibling?.querySelector('svg[data-icon="minus"]')).toBeInTheDocument();
    });

    it('lets long terms wrap instead of keeping them on one line', () => {
      render(<MenuCandidateCard card={GROUP} />);

      const terms = lines()[0].querySelector('[data-terms]') as HTMLElement;
      expect(terms).not.toHaveClass('whitespace-nowrap');
      expect(terms).toHaveClass('flex-wrap');
      expect(within(terms).getByText('arroz')).toHaveClass('wrap-anywhere');
    });

    it('keeps the terms whole beside a long detail, which moves under them when there is no room', () => {
      render(<MenuCandidateCard card={GROUP} />);

      const terms = lines()[0].querySelector('[data-terms]') as HTMLElement;
      expect(terms).toHaveClass('shrink-0', 'max-w-full');
      expect(lines()[0]).toHaveClass('flex-wrap');
      expect(terms.nextElementSibling).toHaveClass('flex-1', 'basis-40');
    });
  });
});

describe('MenuCandidateCard choose button', () => {
  const CHOICE: CardChoice = { formId: 'choose-form', label: 'Elegir para el 12 oct', variant: 'primary', selected: false, disabled: false };

  it('is a submit button of the choose form that posts the menu number', () => {
    render(<MenuCandidateCard card={CARD} choice={CHOICE} />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveAttribute('name', 'menu');
    expect(button).toHaveAttribute('value', '12');
    expect(button).toHaveAttribute('form', 'choose-form');
  });

  it('reads the week it goes to, with an accessible name that starts with it and names the menu', () => {
    render(<MenuCandidateCard card={CARD} choice={CHOICE} />);

    const button = screen.getByRole('button', { name: 'Elegir para el 12 oct (Menú 12)' });
    expect(button).toHaveTextContent('Elegir para el 12 oct');
    expect(button).toHaveClass('bg-olive-600');
  });

  it('is secondary when it replaces a menu', () => {
    render(<MenuCandidateCard card={CARD} choice={{ ...CHOICE, label: 'Cambiar el menú del 5 oct', variant: 'secondary' }} />);

    const button = screen.getByRole('button', { name: 'Cambiar el menú del 5 oct (Menú 12)' });
    expect(button).toHaveClass('border-border-ink');
    expect(button).not.toHaveClass('bg-olive-600');
  });

  it('shows the card of the week’s menu as selected: a check, disabled, with the olive double border', () => {
    render(<MenuCandidateCard card={CARD} choice={{ ...CHOICE, label: 'Menú del 5 oct', selected: true }} />);

    const button = screen.getByRole('button', { name: 'Menú del 5 oct (Menú 12)' });
    expect(button).toBeDisabled();
    expect(button.querySelector('svg[data-icon="check"]')).toBeInTheDocument();
    expect(screen.getByRole('article')).toHaveClass('border-olive-500', 'outline-olive-500');
  });

  it('keeps the plain border when it is not selected', () => {
    render(<MenuCandidateCard card={CARD} choice={CHOICE} />);

    expect(screen.getByRole('article')).not.toHaveClass('border-olive-500');
  });

  it('is disabled while a choice runs', () => {
    render(<MenuCandidateCard card={CARD} choice={{ ...CHOICE, disabled: true }} />);

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('has no "Ver semana" button: the selector holds the link', () => {
    render(<MenuCandidateCard card={CARD} choice={CHOICE} />);

    expect(screen.queryByText('Ver semana')).not.toBeInTheDocument();
  });

  describe('replacing the menu of a week', () => {
    const REPLACE: CardChoice = {
      ...CHOICE,
      label: 'Cambiar el menú del 5 oct',
      variant: 'secondary',
      replacing: { text: '¿Cambiar el Menú 31 por el Menú 12 en la semana del 5 oct?', open: false, onAsk: vi.fn(), onCancel: vi.fn() },
    };

    it('asks for the confirmation instead of posting when the button is pressed', () => {
      const onAsk = vi.fn();
      render(<MenuCandidateCard card={CARD} choice={{ ...REPLACE, replacing: { ...REPLACE.replacing!, onAsk } }} />);

      const posted = fireEvent.click(screen.getByRole('button', { name: 'Cambiar el menú del 5 oct (Menú 12)' }));

      expect(onAsk).toHaveBeenCalledOnce();
      expect(posted).toBe(false);
    });

    it('swaps the buttons for the question with Cambiar and Cancelar when it is open', () => {
      const onCancel = vi.fn();
      render(
        <MenuCandidateCard
          card={CARD}
          choice={{ ...REPLACE, replacing: { ...REPLACE.replacing!, open: true, onCancel } }}
        />,
      );

      expect(screen.getByRole('group', { name: 'Confirmar cambio' })).toHaveTextContent(
        '¿Cambiar el Menú 31 por el Menú 12 en la semana del 5 oct?',
      );
      expect(screen.queryByRole('button', { name: /Cambiar el menú del 5 oct/ })).not.toBeInTheDocument();
      const change = screen.getByRole('button', { name: 'Cambiar' });
      expect(change).toHaveAttribute('type', 'submit');
      expect(change).toHaveAttribute('name', 'menu');
      expect(change).toHaveAttribute('value', '12');
      expect(change).toHaveAttribute('form', 'choose-form');
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(onCancel).toHaveBeenCalledOnce();
    });
  });
});
