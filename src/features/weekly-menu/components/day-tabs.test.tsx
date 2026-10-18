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
  const [active, setActive] = useState<DayDto>(initial);
  return <DayTabs days={DAYS} active={active} today="2026-10-07" onSelect={setActive} />;
}

const day = (name: RegExp) => screen.getByRole('button', { name });
const currentDays = () => screen.getAllByRole('button').filter((button) => button.getAttribute('aria-current') === 'true');

describe('DayTabs', () => {
  it('shows seven day buttons, Monday to Sunday, in a navigation landmark, each with its weekday and day of the month', () => {
    render(<Week />);

    expect(screen.getByRole('navigation', { name: 'Días de la semana' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button').map((item) => item.textContent)).toEqual([
      'Lun5',
      'Mar6',
      'Mié7hoy',
      'Jue8',
      'Vie9',
      'Sáb10',
      'Dom11',
    ]);
  });

  it('marks one day as the current one', () => {
    render(<Week />);

    expect(currentDays()).toEqual([day(/Mié/)]);
  });

  it('marks today for assistive technology too, not only with a dot', () => {
    render(<Week initial="monday" />);

    expect(day(/Mié/)).toHaveAccessibleName('Mié 7 hoy');
    expect(day(/Lun/)).toHaveAccessibleName('Lun 5');
  });

  it("keeps today's dot clear of the day of the month, 1 px from the bottom of the button", () => {
    render(<Week initial="monday" />);

    // The design system's 5 px leaves the dot touching the number (seen in the browser, MF-69).
    expect(day(/Mié/).querySelector('.absolute')).toHaveClass('bottom-px');
  });

  it('selects the day pressed', () => {
    render(<Week />);

    fireEvent.click(day(/Lun/));

    expect(currentDays()).toEqual([day(/Lun/)]);
  });

  it.each([
    ['ArrowRight', /Jue/],
    ['ArrowLeft', /Mar/],
    ['Home', /Lun/],
    ['End', /Dom/],
  ])('moves the focus and the selection with %s', (key, expected) => {
    render(<Week />);

    fireEvent.keyDown(day(/Mié/), { key });

    expect(currentDays()).toEqual([day(expected)]);
    expect(day(expected)).toHaveFocus();
  });

  it('wraps around at both ends', () => {
    render(<Week initial="sunday" />);

    fireEvent.keyDown(day(/Dom/), { key: 'ArrowRight' });
    expect(day(/Lun/)).toHaveFocus();

    fireEvent.keyDown(day(/Lun/), { key: 'ArrowLeft' });
    expect(day(/Dom/)).toHaveFocus();
  });
});
