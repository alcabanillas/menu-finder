import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ShoppingChecklistCategoryDto } from '@/application/dto/shopping-checklist';
import { CategoryIndex } from '@/features/shopping-list/components/category-index';

const item = (position: number, name: string, checked: boolean) => ({
  position,
  name,
  quantity: null,
  unit: null,
  optional: false,
  checked,
});

const LEGUMBRES: ShoppingChecklistCategoryDto = {
  name: 'Legumbres, semillas, frutos secos y derivados',
  checkedCount: 1,
  items: [item(1, 'Garbanzos cocidos', true), item(2, 'Piñones', false)],
};
const LACTEOS: ShoppingChecklistCategoryDto = { name: 'Lácteos', checkedCount: 0, items: [item(3, 'Leche', false)] };

const FORM = { action: () => {}, onSubmit: () => {} };

const show = () =>
  render(
    <CategoryIndex
      menuNumber={9101}
      entries={[
        { category: LEGUMBRES, anchor: 'categoria-1' },
        { category: LACTEOS, anchor: 'categoria-3' },
      ]}
      form={FORM}
    />,
  );
const index = () => screen.getByRole('navigation', { name: 'Categorías' });

describe('CategoryIndex', () => {
  it('lists the categories in order, each with a link to it under its full name and its count', () => {
    show();

    const links = within(index()).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Legumbres, semillas, frutos secos y derivados', 'Lácteos']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['#categoria-1', '#categoria-3']);
    expect(within(index()).getByText('1/2')).toBeInTheDocument();
    expect(within(index()).getByText('0/1')).toBeInTheDocument();
  });

  it("gives each category its tick-every-item control, with the category's state", () => {
    show();

    const legumbres = within(index()).getByRole('checkbox', {
      name: 'Marcar todos: Legumbres, semillas, frutos secos y derivados',
    });
    expect(legumbres).toHaveAttribute('aria-checked', 'mixed');
    expect(within(index()).getByRole('checkbox', { name: 'Marcar todos: Lácteos' })).toHaveAttribute('aria-checked', 'false');
  });

  it('posts every position of the category, ticking them all when not all are ticked', () => {
    show();

    const control = within(index()).getByRole('checkbox', { name: /Legumbres/ });
    const data = new FormData(control.closest('form') as HTMLFormElement);
    expect(data.get('menuNumber')).toBe('9101');
    expect(data.getAll('position')).toEqual(['1', '2']);
    expect(data.get('checked')).toBe('true');
  });
});
