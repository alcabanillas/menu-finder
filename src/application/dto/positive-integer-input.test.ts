import { describe, expect, it } from 'vitest';
import { positiveIntegerInput } from '@/application/dto/positive-integer-input';

describe('positiveIntegerInput', () => {
  it.each([[3], ['12']])('accepts %s as a positive integer', (input) => {
    const parsed = positiveIntegerInput.safeParse(input);

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toBe(Number(input));
  });

  it.each([[0], [-1], [1.5], ['12abc'], ['1.5'], [''], [Number.MAX_SAFE_INTEGER + 1]])(
    'refuses %s',
    (input) => {
      expect(positiveIntegerInput.safeParse(input).success).toBe(false);
    },
  );
});
