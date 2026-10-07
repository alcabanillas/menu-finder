// Spanish decimal comma; `es-ES` writes 1000 without a thousands separator.
const NUMBER = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });

/** "400 g", "1000 ml", "2" for a count, "0,5 g"; nothing when the item has no quantity. */
export function formatAmount(quantity: number | null, unit: string | null): string {
  if (quantity === null) return '';
  const amount = NUMBER.format(quantity);
  return unit ? `${amount} ${unit}` : amount;
}
