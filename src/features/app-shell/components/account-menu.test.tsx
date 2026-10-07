import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccountMenu } from '@/features/app-shell/components/account-menu';

const EMAIL = 'ana@example.test';

function renderMenu(signOut: () => Promise<void> = async () => {}) {
  return render(
    <div>
      <p>Fuera del menú</p>
      <AccountMenu email={EMAIL} signOutAction={signOut} />
    </div>,
  );
}

const button = () => screen.getByRole('button', { name: 'Cuenta' });
const open = () => fireEvent.click(button());

describe('AccountMenu', () => {
  // Spec app-shell, "Closed by default".
  it('is closed by default: the button reports it and neither the email nor the sign-out control is shown', () => {
    renderMenu();

    expect(button()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(EMAIL)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
  });

  // Spec app-shell, "Open".
  it('opens when the button is activated, and the button says so and points to the panel', () => {
    renderMenu();

    open();

    expect(button()).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('button', { name: 'Cerrar sesión' }).closest('[id]');
    expect(button()).toHaveAttribute('aria-controls', panel!.id);
  });

  it('closes again when the button is activated a second time', () => {
    renderMenu();
    open();

    open();

    expect(button()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
  });

  // Spec app-shell, "Escape closes the panel and returns the focus".
  it('closes with Escape and gives the focus back to the button', () => {
    renderMenu();
    open();
    screen.getByRole('button', { name: 'Cerrar sesión' }).focus();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
    expect(button()).toHaveFocus();
  });

  // Spec app-shell, "A click outside closes the panel".
  it('closes when the user presses outside it, and stays open when the press is inside', () => {
    renderMenu();
    open();

    fireEvent.mouseDown(screen.getByText(EMAIL));
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText('Fuera del menú'));
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
  });

  it('listens to the document only while it is open', () => {
    const add = vi.spyOn(document, 'addEventListener');
    renderMenu();
    expect(add).not.toHaveBeenCalledWith('keydown', expect.anything());

    open();

    expect(add).toHaveBeenCalledWith('keydown', expect.anything());
    expect(add).toHaveBeenCalledWith('mousedown', expect.anything());
    add.mockRestore();
  });

  // Spec app-shell, "The menu shows the email and no other user data".
  it('shows the email and the sign-out control, and nothing else of the user', () => {
    renderMenu();

    open();

    const panel = screen.getByText(EMAIL).parentElement!;
    expect(panel).toHaveTextContent(`${EMAIL}Cerrar sesión`);
  });

  it('calls the sign-out action it received when "Cerrar sesión" is activated', async () => {
    const signOut = vi.fn(async () => {});
    renderMenu(signOut);
    open();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });
});
