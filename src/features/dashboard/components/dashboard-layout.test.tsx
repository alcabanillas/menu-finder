import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DashboardLayout } from '@/features/dashboard/components/dashboard-layout';

const slots = { weeks: <p>semanas</p>, meals: <p>hoy</p>, shopping: <p>compra</p> };

describe('DashboardLayout', () => {
  it("heads the page with what is on today and today's date, with the day's colour", () => {
    render(<DashboardLayout today="2026-10-16" {...slots} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Qué toca hoy' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Hoy' })).not.toBeInTheDocument();
    const date = screen.getByText('Viernes 16 de octubre');
    expect(date.querySelector('[aria-hidden="true"]')).toHaveClass('bg-day-fri');
  });

  it("lays out the weeks, today's meals and the shopping in the mock's order on a phone", () => {
    const { container } = render(<DashboardLayout today="2026-10-16" {...slots} />);

    const texts = [...container.querySelectorAll('p')].map((node) => node.textContent);
    expect(texts.filter((text) => ['semanas', 'hoy', 'compra'].includes(text ?? ''))).toEqual([
      'semanas',
      'hoy',
      'compra',
    ]);
  });

  it('puts today in the wide column and the weeks and the shopping in the narrow one from 800 px', () => {
    render(<DashboardLayout today="2026-10-16" {...slots} />);

    expect(screen.getByText('hoy').closest('section')).toHaveClass('@min-[800px]:col-start-1', '@min-[800px]:row-span-2');
    expect(screen.getByText('semanas').parentElement).toHaveClass('@min-[800px]:col-start-2');
    expect(screen.getByText('compra').parentElement).toHaveClass('@min-[800px]:col-start-2');
  });

  it('leaves out the date when it is not known', () => {
    render(<DashboardLayout {...slots} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Qué toca hoy' })).toBeInTheDocument();
    expect(screen.queryByText(/octubre/)).not.toBeInTheDocument();
  });
});
