import * as Sentry from '@sentry/nextjs';
import { fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GlobalError from '@/app/global-error';

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));

const LEAKY_ERROR = Object.assign(new Error('SELECT * FROM menus failed'), { digest: 'abc123' });

afterEach(() => {
  vi.mocked(Sentry.captureException).mockClear();
});

describe('root layout error boundary', () => {
  it('reports the error to Sentry once, passing only the error', () => {
    renderGlobalError(vi.fn());

    expect(Sentry.captureException).toHaveBeenCalledExactlyOnceWith(LEAKY_ERROR);
  });

  it('shows a fixed message and hides the message and the digest of the error', () => {
    renderGlobalError(vi.fn());

    expect(screen.getByRole('alert')).toHaveTextContent('Algo ha fallado');
    expect(document.body).not.toHaveTextContent('SELECT * FROM menus failed');
    expect(document.body).not.toHaveTextContent('abc123');
  });

  it('calls retry when the user presses "Intentar de nuevo"', () => {
    const retry = vi.fn();
    renderGlobalError(retry);

    fireEvent.click(screen.getByRole('button', { name: 'Intentar de nuevo' }));

    expect(retry).toHaveBeenCalledOnce();
  });

  it('renders its own html and body, because it replaces the root layout', () => {
    const html = renderToDocument();

    expect(html).toMatch(/^<html lang="es"/);
    expect(html).toContain('<body');
  });
});

// <html> cannot be a child of the <div> Testing Library mounts, so the document is rendered to a string.
function renderToDocument(): string {
  return renderToStaticMarkup(<GlobalError error={LEAKY_ERROR} retry={vi.fn()} />);
}

function renderGlobalError(retry: () => void) {
  render(<GlobalError error={LEAKY_ERROR} retry={retry} />, { container: document });
}
