import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StackTraceCheckButton } from '@/features/menu-planner/components/stack-trace-check-button';

const uncaught: unknown[] = [];

function recordUncaught(event: ErrorEvent) {
  event.preventDefault();
  uncaught.push(event.error);
}

afterEach(() => {
  window.removeEventListener('error', recordUncaught);
  uncaught.length = 0;
});

describe('StackTraceCheckButton', () => {
  it('throws an uncaught error with a fixed message when clicked, for the Sentry check of MF-22.6', () => {
    window.addEventListener('error', recordUncaught);
    render(<StackTraceCheckButton />);

    fireEvent.click(screen.getByRole('button', { name: 'Lanzar error de prueba' }));

    expect(uncaught).toEqual([new Error('MF-22.6 stack trace check')]);
  });
});
