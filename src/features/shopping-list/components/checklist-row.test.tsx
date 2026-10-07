import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChecklistRow } from '@/features/shopping-list/components/checklist-row';

const FORM = { action: vi.fn(), onSubmit: vi.fn((event: { preventDefault: () => void }) => event.preventDefault()) };
const GARBANZOS = { position: 1, name: 'Garbanzos cocidos', quantity: 400, unit: 'g', optional: false, checked: false };

describe('ChecklistRow', () => {
  it('is a checkbox button with the name and the amount', () => {
    render(<ChecklistRow menuNumber={9101} item={GARBANZOS} form={FORM} />);

    const box = screen.getByRole('checkbox', { name: 'Garbanzos cocidos 400 g' });
    expect(box).toHaveAttribute('type', 'submit');
    expect(box).toHaveAttribute('aria-checked', 'false');
  });

  it('posts the menu, its position and the new value: ticking a row that is not ticked sends true', () => {
    const { container } = render(<ChecklistRow menuNumber={9101} item={GARBANZOS} form={FORM} />);

    const data = new FormData(container.querySelector('form') as HTMLFormElement);
    expect([...data.entries()]).toEqual([
      ['menuNumber', '9101'],
      ['position', '1'],
      ['checked', 'true'],
    ]);
  });

  it('sends false for a ticked row and says it is checked', () => {
    const { container } = render(<ChecklistRow menuNumber={9101} item={{ ...GARBANZOS, checked: true }} form={FORM} />);

    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
    expect(new FormData(container.querySelector('form') as HTMLFormElement).get('checked')).toBe('false');
  });

  it('marks an optional item and shows no amount for an item without quantity', () => {
    render(
      <ChecklistRow
        menuNumber={9101}
        item={{ ...GARBANZOS, name: 'Comino', quantity: null, unit: null, optional: true }}
        form={FORM}
      />,
    );

    expect(screen.getByRole('checkbox', { name: 'Comino opcional' })).toBeInTheDocument();
  });

  it('runs the form handler on submit', () => {
    render(<ChecklistRow menuNumber={9101} item={GARBANZOS} form={FORM} />);

    fireEvent.click(screen.getByRole('checkbox'));

    expect(FORM.onSubmit).toHaveBeenCalled();
  });
});
