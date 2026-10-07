import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from '@/features/app-shell/components/app-shell';

vi.mock('next/navigation', () => ({ usePathname: () => '/planner' }));

const ACCOUNT = { email: 'ana@example.test', signOutAction: async () => {} };

function renderShell() {
  return render(
    <AppShell account={ACCOUNT}>
      <h1>Contenido de la página</h1>
    </AppShell>,
  );
}

describe('AppShell', () => {
  it('has a header whose wordmark links to the home', () => {
    renderShell();

    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: 'Menu Finder' })).toHaveAttribute('href', '/');
  });

  it('offers the main navigation in the header and in the bottom bar, with the four links each', () => {
    renderShell();

    const navigations = screen.getAllByRole('navigation', { name: 'Principal' });
    expect(navigations).toHaveLength(2);
    for (const navigation of navigations) {
      expect(within(navigation).getAllByRole('link').map((link) => link.textContent)).toEqual([
        'Hoy',
        'Buscar',
        'Menú',
        'Compra',
      ]);
    }
    expect(within(screen.getByRole('banner')).getAllByRole('navigation')).toHaveLength(1);
  });

  it('has one main landmark and the page content is inside it', () => {
    renderShell();

    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { name: 'Contenido de la página' })).toBeInTheDocument();
  });

  it('has the account button in the header, and the panel opens with the email it received', () => {
    renderShell();

    const button = within(screen.getByRole('banner')).getByRole('button', { name: 'Cuenta' });
    fireEvent.click(button);

    expect(screen.getByText('ana@example.test')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });

  it('has no account button when it is given no account', () => {
    render(
      <AppShell>
        <h1>Contenido de la página</h1>
      </AppShell>,
    );

    expect(screen.queryByRole('button', { name: 'Cuenta' })).not.toBeInTheDocument();
  });

  it('has no sign-in link when it is not told that there is no session', () => {
    renderShell();

    expect(screen.queryByRole('link', { name: 'Acceder' })).not.toBeInTheDocument();
  });

  describe('for a visitor with no session', () => {
    function renderSignedOutShell() {
      return render(
        <AppShell session="out">
          <h1>Contenido de la página</h1>
        </AppShell>,
      );
    }

    it('offers the wordmark and a link to sign in, and no main navigation', () => {
      renderSignedOutShell();

      const header = screen.getByRole('banner');
      expect(within(header).getByRole('link', { name: 'Menu Finder' })).toHaveAttribute('href', '/');
      expect(within(header).getByRole('link', { name: 'Acceder' })).toHaveAttribute('href', '/login');
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Buscar' })).not.toBeInTheDocument();
    });

    it('has no account button', () => {
      renderSignedOutShell();

      expect(screen.queryByRole('button', { name: 'Cuenta' })).not.toBeInTheDocument();
    });

    it('keeps the skip link first and the one main landmark with the content', () => {
      const { container } = renderSignedOutShell();

      expect(container.querySelector('a, button, [tabindex="0"]')).toHaveTextContent('Saltar al contenido');
      expect(within(screen.getByRole('main')).getByRole('heading', { name: 'Contenido de la página' })).toBeInTheDocument();
    });
  });

  it('starts with a skip link that points to the main landmark', () => {
    const { container } = renderShell();

    const firstFocusable = container.querySelector('a, button, [tabindex="0"]');
    expect(firstFocusable).toHaveTextContent('Saltar al contenido');
    expect(firstFocusable).toHaveAttribute('href', `#${screen.getByRole('main').id}`);
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
  });
});
