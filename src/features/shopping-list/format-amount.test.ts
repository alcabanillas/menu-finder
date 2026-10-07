import { describe, expect, it } from 'vitest';
import { formatAmount } from '@/features/shopping-list/format-amount';

describe('formatAmount', () => {
  it.each([
    [400, 'g', '400 g'],
    [1000, 'ml', '1000 ml'],
    [2, null, '2'],
    [0.5, 'g', '0,5 g'],
    [1.25, 'kg', '1,25 kg'],
  ])('writes %s %s as "%s"', (quantity, unit, text) => {
    expect(formatAmount(quantity, unit)).toBe(text);
  });

  it('writes nothing when there is no quantity', () => {
    expect(formatAmount(null, null)).toBe('');
    expect(formatAmount(null, 'g')).toBe('');
  });
});
