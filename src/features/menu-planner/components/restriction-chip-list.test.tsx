import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RestrictionChipList } from '@/features/menu-planner/components/restriction-chip-list';
import type { Chip, ChipMember } from '@/features/menu-planner/search-view';

function member(term: string, overrides: Partial<ChipMember> = {}): ChipMember {
  return { term, polarity: 'include', type: 'literal', hard: false, slot: undefined, ...overrides };
}

function chip(members: ChipMember[], kind: Chip['kind'] = 'constraint'): Chip {
  return { kind, members };
}

function renderChips(chips: Chip[]) {
  render(<RestrictionChipList chips={chips} />);
  return screen.getAllByRole('listitem');
}

/** The text for screen readers is the one child that is not hidden. */
function srText(item: HTMLElement): string | null {
  return item.querySelector(':scope > .sr-only')?.textContent ?? null;
}

describe('RestrictionChipList', () => {
  it('is a list named "Lo que has pedido"', () => {
    renderChips([chip([member('garbanzos')])]);

    expect(screen.getByRole('list', { name: 'Lo que has pedido' })).toBeInTheDocument();
  });

  it('shows a soft included literal as an olive chip with a dashed border and a plus', () => {
    const [item] = renderChips([chip([member('garbanzos')])]);

    expect(item).toHaveClass('bg-olive-100', 'border-dashed');
    expect(item).not.toHaveClass('border-solid');
    expect(srText(item)).toBe('garbanzos, preferencia');
    expect(item.querySelector('svg[data-icon="plus"]')).toBeInTheDocument();
  });

  it('shows an included attribute with a sparkles icon, its meal suffix and its screen reader text', () => {
    const [item] = renderChips([chip([member('sencillas', { type: 'attribute', slot: 'dinner' })])]);

    expect(item).toHaveClass('bg-olive-100');
    expect(item.querySelector('svg[data-icon="sparkles"]')).toBeInTheDocument();
    expect(item).toHaveTextContent('· cena');
    expect(srText(item)).toBe('atributo: sencillas, preferencia, en la cena');
  });

  it('shows a hard exclusion as a terracotta chip with a solid border and a minus', () => {
    const [item] = renderChips([chip([member('cerdo', { polarity: 'exclude', type: 'exclusion', hard: true })])]);

    expect(item).toHaveClass('bg-terracotta-50', 'border-solid');
    expect(item.querySelector('svg[data-icon="minus"]')).toBeInTheDocument();
    expect(srText(item)).toBe('excluido: cerdo, obligatorio');
  });

  it('shows an excluded fuzzy constraint as terracotta with a minus', () => {
    const [item] = renderChips([chip([member('fritos', { polarity: 'exclude', type: 'fuzzy' })])]);

    expect(item).toHaveClass('bg-terracotta-50');
    expect(item.querySelector('svg[data-icon="minus"]')).toBeInTheDocument();
  });

  it('shows a same-dish group with both polarities as an ochre chip with a vertical rule', () => {
    const items = renderChips([
      chip([member('arroz'), member('marisco', { polarity: 'exclude', type: 'exclusion' })], 'sameDish'),
      chip([member('pollo')]),
    ]);

    expect(items).toHaveLength(2);
    expect(items[0]).toHaveClass('bg-ochre-100', 'border-ochre-300');
    expect(srText(items[0])).toBe('En el mismo plato: arroz, preferencia y excluido: marisco, preferencia');
    const members = items[0].querySelectorAll('[data-member]');
    expect(members[0]).toHaveClass('text-include-on-tint');
    expect(members[1]).toHaveClass('text-exclude-on-tint');
    expect(items[0].querySelector('[data-separator="and"]')).toBeInTheDocument();
    expect(items[1]).toHaveClass('bg-olive-100');
  });

  it('shows an any-of group with an "o" between its members', () => {
    const [item] = renderChips([chip([member('lubina'), member('dorada')], 'anyOf')]);

    expect(item).toHaveClass('bg-olive-100');
    expect(srText(item)).toBe('Una de: lubina, preferencia o dorada, preferencia');
    expect(item.querySelector('[data-separator="or"]')).toHaveTextContent('o');
  });

  it('gives a group with a hard and a soft member a solid border and underlines only the soft one', () => {
    const [item] = renderChips([chip([member('arroz', { hard: true }), member('verduras')], 'sameDish')]);

    expect(item).toHaveClass('border-solid');
    const [hard, soft] = Array.from(item.querySelectorAll('[data-member]'));
    expect(within(hard as HTMLElement).getByText('arroz')).not.toHaveClass('decoration-dashed');
    expect(within(soft as HTMLElement).getByText('verduras')).toHaveClass('underline', 'decoration-dashed');
  });

  it('shows the meal once, at the end, when every member has the same one', () => {
    const [item] = renderChips([
      chip([member('arroz', { slot: 'dinner' }), member('verduras', { slot: 'dinner' })], 'sameDish'),
    ]);

    expect(item.textContent?.match(/· cena/g)).toHaveLength(1);
    expect(item.querySelectorAll('[data-member] [data-slot]')).toHaveLength(0);
  });

  it('shows each member its own meal when they differ', () => {
    const [item] = renderChips([
      chip([member('arroz', { slot: 'lunch' }), member('verduras', { slot: 'dinner' })], 'sameDish'),
    ]);

    const slots = Array.from(item.querySelectorAll('[data-member] [data-slot]')).map((node) => node.textContent);
    expect(slots).toEqual(['· comida', '· cena']);
    expect(srText(item)).toContain('en la comida');
    expect(srText(item)).toContain('en la cena');
  });

  it('hides the icons, the separators and the visible members from screen readers', () => {
    const [item] = renderChips([chip([member('lubina'), member('dorada')], 'anyOf')]);

    for (const node of item.querySelectorAll('svg, [data-separator], [data-member]')) {
      expect(node.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it('lets a long term wrap instead of cutting it', () => {
    const [item] = renderChips([chip([member('una cosa con un nombre larguísimo')])]);

    expect(within(item).getByText('una cosa con un nombre larguísimo')).toHaveClass('wrap-anywhere');
  });

  it('renders a term with HTML metacharacters as text, never as markup', () => {
    const term = '<img src=x onerror=alert(1)> & "<b>"';
    const [item] = renderChips([chip([member(term)])]);

    expect(item.querySelector('img, b')).toBeNull();
    expect(within(item).getByText(term)).toBeInTheDocument();
  });

  it('has no control: no chip is a button, a link or an input', () => {
    renderChips([chip([member('garbanzos')]), chip([member('cerdo', { polarity: 'exclude' })])]);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
