import * as Sentry from '@sentry/nextjs';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PageError from '@/app/error';

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));

const LEAKY_ERROR = Object.assign(new Error('SELECT * FROM menus failed'), { digest: 'abc123' });

afterEach(() => {
  vi.mocked(Sentry.captureException).mockClear();
});

describe('page error boundary', () => {
  it('reports the error to Sentry once, passing only the error', () => {
    render(<PageError error={LEAKY_ERROR} retry={vi.fn()} />);

    expect(Sentry.captureException).toHaveBeenCalledExactlyOnceWith(LEAKY_ERROR);
  });

  it('does not report again when it re-renders with the same error', () => {
    const { rerender } = render(<PageError error={LEAKY_ERROR} retry={vi.fn()} />);

    rerender(<PageError error={LEAKY_ERROR} retry={vi.fn()} />);

    expect(Sentry.captureException).toHaveBeenCalledOnce();
  });

  it('shows a fixed message and hides the message and the digest of the error', () => {
    render(<PageError error={LEAKY_ERROR} retry={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Algo ha fallado');
    expect(document.body).not.toHaveTextContent('SELECT * FROM menus failed');
    expect(document.body).not.toHaveTextContent('abc123');
  });

  it('calls retry when the user presses "Intentar de nuevo"', () => {
    const retry = vi.fn();
    render(<PageError error={LEAKY_ERROR} retry={retry} />);

    fireEvent.click(screen.getByRole('button', { name: 'Intentar de nuevo' }));

    expect(retry).toHaveBeenCalledOnce();
  });
});
