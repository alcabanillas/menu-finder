import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from '@/features/shopping-list/components/progress-bar';

const fillOf = () => screen.getByRole('progressbar').firstElementChild as HTMLElement;

describe('ProgressBar', () => {
  it('shows the label and "N de M"', () => {
    render(<ProgressBar value={1} max={3} label="Marcados" />);

    expect(screen.getByText('Marcados')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '1 de 3');
    expect(screen.getByText('de 3', { exact: false }).textContent).toBe('1 de 3');
  });

  it('fills the share of the total', () => {
    render(<ProgressBar value={1} max={4} label="Marcados" />);

    expect(fillOf().style.width).toBe('25%');
  });

  it.each([
    [7, 3, '100%'],
    [-2, 3, '0%'],
    [0, 0, '0%'],
  ])('clamps the width to 0-100 %% (%i of %i)', (value, max, width) => {
    render(<ProgressBar value={value} max={max} label="Marcados" />);

    expect(fillOf().style.width).toBe(width);
  });
});
