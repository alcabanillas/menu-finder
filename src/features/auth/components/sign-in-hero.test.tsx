import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SignInHero } from '@/features/auth/components/sign-in-hero';

describe('SignInHero', () => {
  it('describes the product under the wordmark, with no data from the catalogue or the user', () => {
    render(<SignInHero />);

    expect(screen.getByRole('complementary')).toHaveTextContent('Menu Finder');
    expect(screen.getByRole('heading', { level: 2, name: 'Un menú para cada semana' })).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toEqual([]);
  });

  it('hides the day colours from assistive technology', () => {
    const { container } = render(<SignInHero />);

    expect(container.querySelector('[aria-hidden="true"]')?.children).toHaveLength(7);
  });
});
