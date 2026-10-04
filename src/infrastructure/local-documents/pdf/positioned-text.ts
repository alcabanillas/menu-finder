export type PositionedText = { x: number; y: number; text: string };

export type ReadPositionedTextOptions = {
  maxPages?: number;
};

// PDF.js gives each text item a transform matrix [a, b, c, d, e, f]: e and f are its x and y on the page.
const TRANSFORM_X = 4;
const TRANSFORM_Y = 5;

/**
 * Reads text items with their page coordinates from a PDF buffer.
 * Reads up to `options.maxPages` when specified, or all pages if omitted.
 */
export async function readPositionedText(
  data: Buffer,
  options?: ReadPositionedTextOptions,
): Promise<PositionedText[][]> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await getDocument({ data: new Uint8Array(data), verbosity: 0 }).promise;
  try {
    const limit = options?.maxPages ? Math.min(document.numPages, options.maxPages) : document.numPages;
    const pages: PositionedText[][] = [];
    for (let number = 1; number <= limit; number += 1) {
      const { items } = await (await document.getPage(number)).getTextContent();
      pages.push(
        items.flatMap((item) =>
          'str' in item
            ? [{ x: item.transform[TRANSFORM_X] as number, y: item.transform[TRANSFORM_Y] as number, text: item.str }]
            : [],
        ),
      );
    }
    return pages;
  } finally {
    await document.destroy();
  }
}
