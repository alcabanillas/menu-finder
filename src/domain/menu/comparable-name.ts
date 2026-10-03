

/** Lowercase, accent-free words separated by single spaces: the form dish and recipe names are compared in. */
export const toComparableName = (text: string): string =>
  stripAccents(text.toLowerCase())
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
