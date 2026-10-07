import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  RandomMenuForm,
  type RandomMenuState,
} from '@/features/menu-planner/components/random-menu-form';

const answering = (state: Omit<RandomMenuState, 'attempt'>) =>
  vi.fn(async (previous: RandomMenuState) => ({
    ...state,
    attempt: previous.attempt + 1,
  }));

describe('RandomMenuForm', () => {
  it('has one submit button and no message before the first answer', () => {
    render(
      <RandomMenuForm action={answering({ message: null, failed: false })} />,
    );

    expect(
      screen.getByRole('button', { name: 'Elegir un menú al azar' }),
    ).toHaveAttribute('type', 'submit');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('announces a success in a status region', async () => {
    render(
      <RandomMenuForm
        action={answering({
          message: 'Te ha tocado el menú 12.',
          failed: false,
        })}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Elegir un menú al azar' }),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Te ha tocado el menú 12.',
    );
  });

  it('announces a failure in an alert', async () => {
    render(
      <RandomMenuForm
        action={answering({
          message: 'No hay menús para elegir.',
          failed: true,
        })}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Elegir un menú al azar' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No hay menús para elegir.',
    );
  });
});
