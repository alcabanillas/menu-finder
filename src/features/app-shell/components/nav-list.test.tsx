import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NavList } from '@/features/app-shell/components/nav-list';

const navigation = vi.hoisted(() => ({ usePathname: vi.fn<() => string>() }));
vi.mock('next/navigation', () => navigation);

function renderAt(pathname: string, placement: 'header' | 'bottom' = 'header') {
  navigation.usePathname.mockReturnValue(pathname);
  render(<NavList placement={placement} />);
}

describe('NavList', () => {
  beforeEach(() => navigation.usePathname.mockReset());

  it('has the four links in order, each with its destination', () => {
    renderAt('/planner');

    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Hoy', 'Buscar', 'Menú', 'Compra']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/', '/planner', '/menu', '/shopping-list']);
  });

  it('marks only the link of the current route as the current page', () => {
    renderAt('/planner');

    expect(screen.getByRole('link', { name: 'Buscar' })).toHaveAttribute('aria-current', 'page');
    for (const name of ['Hoy', 'Menú', 'Compra']) {
      expect(screen.getByRole('link', { name })).not.toHaveAttribute('aria-current');
    }
  });

  it('marks no link for a route that is not a tab', () => {
    renderAt('/somewhere-else');

    for (const link of screen.getAllByRole('link')) expect(link).not.toHaveAttribute('aria-current');
  });

  it('marks a tab for the routes below it', () => {
    renderAt('/menu/anything');

    expect(screen.getByRole('link', { name: 'Menú' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Hoy' })).not.toHaveAttribute('aria-current');
  });

  it('marks "Hoy" only for exactly `/`', () => {
    renderAt('/');

    expect(screen.getByRole('link', { name: 'Hoy' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Buscar' })).not.toHaveAttribute('aria-current');
  });

  it('does not mark a tab for a route that only starts with its text', () => {
    renderAt('/menus');

    expect(screen.getByRole('link', { name: 'Menú' })).not.toHaveAttribute('aria-current');
  });

  it('puts the icon beside the label in the header and above it in the bottom bar', () => {
    renderAt('/planner', 'header');
    expect(screen.getByRole('link', { name: 'Buscar' })).not.toHaveClass('flex-col');
  });

  it('stacks the icon over the label in the bottom bar', () => {
    renderAt('/planner', 'bottom');
    expect(screen.getByRole('link', { name: 'Buscar' })).toHaveClass('flex-col');
  });
});
