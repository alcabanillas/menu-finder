/** Lowercase, accent-free table label, punctuation kept: used to recognise day and meal rows. */
export const normalizeLabel = (label: string | undefined): string =>
  (label ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
