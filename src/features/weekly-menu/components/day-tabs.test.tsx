import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { DayDto } from '@/application/dto/weekly-menu';
import { DayTabs } from '@/features/weekly-menu/components/day-tabs';

const DAYS: { day: DayDto; date: string }[] = [
  { day: 'monday', date: '2026-10-05' },
  { day: 'tuesday', date: '2026-10-06' },
  { day: 'wednesday', date: '2026-10-07' },
  { day: 'thursday', date: '2026-10-08' },
  { day: 'friday', date: '2026-10-09' },
  { day: 'saturday', date: '2026-10-10' },
  { day: 'sunday', date: '2026-10-11' },
];

function Week({ initial = 'wednesday' as DayDto }) {
  const [selected, setSelected] = useState<DayDto>(initial);
  return <DayTabs days={DAYS} selected={selected} today="2026-10-07" panelId="panel" onSelect={setSelected} />;
}

const tab = (name: RegExp) => screen.getByRole('tab', { name });
const selectedTabs = () => screen.getAllByRole('tab', { selected: true });

describe('DayTabs', () => {
  it('shows seven tabs, Monday to Sunday, each with its weekday and day of the month', () => {
    render(<Week />);

    expect(screen.getByRole('tablist', { name: 'Días de la semana' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((item) => item.textContent)).toEqual([
      'Lun5',
      'Mar6',
      'Mié7hoy',
      'Jue8',
      'Vie9',
      'Sáb10',
      'Dom11',
    ]);
  });

  it('selects one tab, the only one reachable with Tab, and points it at the panel', () => {
    render(<Week />);

    expect(selectedTabs()).toEqual([tab(/Mié/)]);
    expect(tab(/Mié/)).toHaveAttribute('tabindex', '0');
    expect(tab(/Lun/)).toHaveAttribute('tabindex', '-1');
    expect(tab(/Mié/)).toHaveAttribute('aria-controls', 'panel');
  });

  it('marks today for assistive technology too, not only with a dot', () => {
    render(<Week initial="monday" />);

    expect(tab(/Mié/)).toHaveAccessibleName('Mié 7 hoy');
    expect(tab(/Lun/)).toHaveAccessibleName('Lun 5');
  });

  it('selects the day pressed', () => {
    render(<Week />);

    fireEvent.click(tab(/Lun/));

    expect(selectedTabs()).toEqual([tab(/Lun/)]);
  });

  it.each([
    ['ArrowRight', /Jue/],
    ['ArrowLeft', /Mar/],
    ['Home', /Lun/],
    ['End', /Dom/],
  ])('moves the focus and the selection with %s', (key, expected) => {
    render(<Week />);

    fireEvent.keyDown(tab(/Mié/), { key });

    expect(selectedTabs()).toEqual([tab(expected)]);
    expect(tab(expected)).toHaveFocus();
  });

  it('wraps around at both ends', () => {
    render(<Week initial="sunday" />);

    fireEvent.keyDown(tab(/Dom/), { key: 'ArrowRight' });
    expect(tab(/Lun/)).toHaveFocus();

    fireEvent.keyDown(tab(/Lun/), { key: 'ArrowLeft' });
    expect(tab(/Dom/)).toHaveFocus();
  });
});
