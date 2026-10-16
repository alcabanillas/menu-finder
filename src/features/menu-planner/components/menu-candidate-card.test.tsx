import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MenuCandidateCard } from '@/features/menu-planner/components/menu-candidate-card';
import type { CandidateCard, ChipMember } from '@/features/menu-planner/search-view';

function member(term: string, overrides: Partial<ChipMember> = {}): ChipMember {
  return { term, polarity: 'include', type: 'literal', hard: false, slot: undefined, ...overrides };
}

const CARD: CandidateCard = {
  rank: 2,
  menu: 12,
  lines: [
    { kind: 'constraint', terms: [member('garbanzos')], found: true, detail: 'Martes, comida · Garbanzos con espinacas' },
    { kind: 'constraint', terms: [member('cerdo', { polarity: 'exclude', type: 'exclusion' })], found: true, detail: 'no aparece en la semana' },
    { kind: 'constraint', terms: [member('salmón')], found: false, detail: 'ningún plato' },
    { kind: 'constraint', terms: [member('sencillas', { type: 'attribute' })], found: true, detail: 'Lunes, cena · Crema' },
  ],
};

function lines(): HTMLElement[] {
  return within(screen.getByRole('article')).getAllByRole('listitem');
}

describe('MenuCandidateCard', () => {
  it('shows the rank and "Menú N"', () => {
    render(<MenuCandidateCard card={CARD} />);

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Menú 12')).toBeInTheDocument();
  });

  it('shows one line per unit with its terms and its detail', () => {
    render(<MenuCandidateCard card={CARD} />);

    expect(lines()).toHaveLength(4);
    expect(lines()[0]).toHaveTextContent('garbanzos');
    expect(lines()[0]).toHaveTextContent('Martes, comida · Garbanzos con espinacas');
    expect(lines()[1]).toHaveTextContent('no aparece en la semana');
  });

  it('shows a check when the unit is answered and a cross when no dish covers it', () => {
    render(<MenuCandidateCard card={CARD} />);

    expect(lines()[0].querySelector('svg[data-icon="check"]')).toBeInTheDocument();
    expect(lines()[1].querySelector('svg[data-icon="check"]')).toBeInTheDocument();
    expect(lines()[2].querySelector('svg[data-icon="x"]')).toBeInTheDocument();
    expect(lines()[2]).toHaveTextContent('ningún plato');
  });

  it('colours the terms: olive for include and attribute, terracotta for exclude', () => {
    render(<MenuCandidateCard card={CARD} />);

    expect(within(lines()[0]).getByText('garbanzos')).toHaveClass('text-olive-600');
    expect(within(lines()[1]).getByText('cerdo')).toHaveClass('text-terracotta-600');
    expect(within(lines()[3]).getByText('sencillas')).toHaveClass('text-olive-600');
  });

  it('separates the terms of a same-dish group with a rule and those of an any-of group with an "o"', () => {
    const card: CandidateCard = {
      rank: 1,
      menu: 3,
      lines: [
        { kind: 'sameDish', terms: [member('arroz'), member('marisco', { polarity: 'exclude' })], found: true, detail: 'Lunes, comida · Arroz' },
        { kind: 'anyOf', terms: [member('lubina'), member('dorada')], found: true, detail: 'Martes, cena · Lubina' },
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
      lines: [
        { kind: 'sameDish', terms: [member('arroz'), member('marisco', { polarity: 'exclude' })], found: true, detail: 'Lunes, comida · Arroz' },
        { kind: 'sameDish', terms: [member('pollo'), member('verduras')], found: true, detail: 'Martes, cena · Pollo' },
        { kind: 'constraint', terms: [member('salmón')], found: false, detail: 'ningún plato' },
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
      lines: [{ kind: 'constraint', terms: [member('<img src=x onerror=alert(1)>')], found: true, detail: 'Lunes, comida · <b>Arroz</b>' }],
    };
    render(<MenuCandidateCard card={card} />);

    expect(screen.getByRole('article').querySelector('img, b')).toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(screen.getByText('Lunes, comida · <b>Arroz</b>')).toBeInTheDocument();
  });

  it('has no title, no explanation and no button', () => {
    render(<MenuCandidateCard card={CARD} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByRole('article').querySelectorAll('p')).toHaveLength(0);
  });

  describe('for a screen reader and without colour', () => {
    const GROUP: CandidateCard = {
      rank: 1,
      menu: 3,
      lines: [
        {
          kind: 'sameDish',
          terms: [member('arroz'), member('marisco', { polarity: 'exclude', type: 'exclusion' })],
          found: true,
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
