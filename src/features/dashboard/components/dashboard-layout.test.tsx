import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DashboardLayout } from '@/features/dashboard/components/dashboard-layout';

describe('DashboardLayout', () => {
  it("heads the page with Hoy and today's date", () => {
    render(<DashboardLayout today="2026-10-07" menu={<p>menú</p>} shopping={<p>compra</p>} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Hoy' })).toBeInTheDocument();
    expect(screen.getByText('Miércoles 7 de octubre')).toBeInTheDocument();
  });

  it("lays out the menu, today's meals and the shopping in the mock's order", () => {
    const { container } = render(
      <DashboardLayout today="2026-10-07" menu={<p>menú</p>} shopping={<p>compra</p>} meals={<p>hoy</p>} />,
    );

    const slots = [...container.querySelectorAll('p')].map((node) => node.textContent);
    expect(slots.filter((text) => ['menú', 'hoy', 'compra'].includes(text ?? ''))).toEqual(['menú', 'hoy', 'compra']);
  });

  it('leaves out the date when it is not known', () => {
    render(<DashboardLayout menu={<p>menú</p>} shopping={<p>compra</p>} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Hoy' })).toBeInTheDocument();
    expect(screen.queryByText(/octubre/)).not.toBeInTheDocument();
  });

  it("leaves out today's meals when there are none", () => {
    render(<DashboardLayout today="2026-10-07" menu={<p>menú</p>} shopping={<p>compra</p>} />);

    expect(screen.queryByText('hoy')).not.toBeInTheDocument();
  });
});
