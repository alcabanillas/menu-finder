import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { err, ok } from '@/shared/result';
import { LocalDocumentSource } from '@/infrastructure/local-documents/local-document-source';

describe('LocalDocumentSource', () => {
  let rawDir: string;

  beforeEach(async () => {
    rawDir = await mkdtemp(join(tmpdir(), 'document-source-'));
  });
  afterEach(async () => {
    await rm(rawDir, { recursive: true, force: true });
  });

  const addFolder = async (name: string, files: string[] = []) => {
    await mkdir(join(rawDir, name));
    for (const file of files) await writeFile(join(rawDir, name, file), '');
  };

  describe('listMenuFolders', () => {
    it('lists only the Menu <n> folders, with their number', async () => {
      await addFolder('Menu 2');
      await addFolder('Menu 10');
      await addFolder('Menu x');
      await addFolder('Notes');
      await writeFile(join(rawDir, 'Menu 3'), 'a file, not a folder');

      const result = await new LocalDocumentSource(rawDir).listMenuFolders();
      if (!result.ok) throw new Error('expected ok');

      expect([...result.value].sort((a, b) => a.number - b.number)).toEqual([
        { number: 2, name: 'Menu 2' },
        { number: 10, name: 'Menu 10' },
      ]);
    });

    it('fails when the raw directory does not exist', async () => {
      const missing = join(rawDir, 'missing');

      expect(await new LocalDocumentSource(missing).listMenuFolders()).toEqual(
        err({ kind: 'missing-raw-directory', path: missing }),
      );
    });
  });

  describe('listRecipeFiles', () => {
    it('returns the recipe PDFs without extension, excluding the non-recipe documents', async () => {
      await addFolder('Menu 1', [
        'menu.pdf',
        'Lista_de_la_compra.pdf',
        'valoracion-inicial.pdf',
        'Lentejas-estofadas.pdf',
        'Merluza-al-horno.pdf',
        'Tarta-de-queso.pdf.txt',
        'notas.txt',
      ]);

      const files = await new LocalDocumentSource(rawDir).listRecipeFiles({ number: 1, name: 'Menu 1' });

      expect([...files].sort()).toEqual(['Lentejas-estofadas', 'Merluza-al-horno']);
    });
  });

  describe('readMenu', () => {
    it('fails with missing-file when the folder has no menu.pdf', async () => {
      await addFolder('Menu 1', ['Lentejas-estofadas.pdf']);

      expect(await new LocalDocumentSource(rawDir).readMenu({ number: 1, name: 'Menu 1' })).toEqual(
        err({ kind: 'missing-file', file: 'menu.pdf' }),
      );
    });

    it('fails with unreadable-document, without throwing, when menu.pdf is not a PDF', async () => {
      await addFolder('Menu 1');
      await writeFile(join(rawDir, 'Menu 1', 'menu.pdf'), 'not a pdf');

      const result = await new LocalDocumentSource(rawDir).readMenu({ number: 1, name: 'Menu 1' });

      expect(result).not.toEqual(ok(expect.anything()));
      expect(!result.ok && result.error.kind).toBe('unreadable-document');
    });
  });

  describe('readRecipe', () => {
    it('fails with missing-file when the recipe file does not exist', async () => {
      await addFolder('Menu 1');

      expect(await new LocalDocumentSource(rawDir).readRecipe({ number: 1, name: 'Menu 1' }, 'Guiso')).toEqual(
        err({ kind: 'missing-file', file: 'Guiso.pdf' }),
      );
    });

    it('fails with unreadable-document, without throwing, when the recipe is not a PDF', async () => {
      await addFolder('Menu 1');
      await writeFile(join(rawDir, 'Menu 1', 'Guiso.pdf'), 'not a pdf');

      const result = await new LocalDocumentSource(rawDir).readRecipe({ number: 1, name: 'Menu 1' }, 'Guiso');

      expect(!result.ok && result.error.kind).toBe('unreadable-document');
    });
  });

  describe('readShoppingList', () => {
    it('reads one list per menu folder, correctly parsing a two-page document', async () => {
      await addFolder('Menu 2');
      const twoPagePdf = createSyntheticPdf([
        [
          { text: 'Lista de la compra', x: 36, y: 750 },
          { text: 'Huevos y derivados', x: 36, y: 700 },
          { text: '- Huevo de gallina: 2', x: 36, y: 680 },
        ],
        [
          { text: 'Pescados, moluscos, crustáceos y derivados', x: 36, y: 700 },
          { text: '- Merluza: 150g', x: 36, y: 680 },
        ],
      ]);
      await writeFile(join(rawDir, 'Menu 2', 'Lista_de_la_compra.pdf'), twoPagePdf);

      const result = await new LocalDocumentSource(rawDir).readShoppingList({ number: 2, name: 'Menu 2' });

      expect(result).toEqual(
        ok({
          pages: 2,
          items: [
            {
              category: 'Huevos y derivados',
              name: 'Huevo de gallina',
              quantity: 2,
              unit: null,
              optional: false,
            },
            {
              category: 'Pescados, moluscos, crustáceos y derivados',
              name: 'Merluza',
              quantity: 150,
              unit: 'g',
              optional: false,
            },
          ],
          anomalies: [],
        }),
      );
    });

    it('finds the list whatever the capitalization of its file name', async () => {
      await addFolder('Menu 5');
      const pdf = createSyntheticPdf([
        [
          { text: 'Huevos y derivados', x: 36, y: 700 },
          { text: '- Huevo de gallina: 2', x: 36, y: 680 },
        ],
      ]);
      await writeFile(join(rawDir, 'Menu 5', 'LISTA_DE_LA_COMPRA.PDF'), pdf);

      const result = await new LocalDocumentSource(rawDir).readShoppingList({ number: 5, name: 'Menu 5' });

      expect(result.ok && result.value.items).toHaveLength(1);
    });

    it('fails with missing-file when the folder has no Lista_de_la_compra.pdf', async () => {
      await addFolder('Menu 3');

      const result = await new LocalDocumentSource(rawDir).readShoppingList({ number: 3, name: 'Menu 3' });

      expect(result).toEqual(err({ kind: 'missing-file', file: 'Lista_de_la_compra.pdf' }));
    });

    it('fails with unreadable-document, without throwing, when Lista_de_la_compra.pdf is not a valid PDF', async () => {
      await addFolder('Menu 4');
      await writeFile(join(rawDir, 'Menu 4', 'Lista_de_la_compra.pdf'), 'not a valid pdf');

      const result = await new LocalDocumentSource(rawDir).readShoppingList({ number: 4, name: 'Menu 4' });

      expect(result).not.toEqual(ok(expect.anything()));
      expect(!result.ok && result.error.kind).toBe('unreadable-document');
    });
  });
});

function createSyntheticPdf(pages: { text: string; x: number; y: number }[][]): Buffer {
  const pageCount = pages.length;
  const kids = pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ');
  let body = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  body += `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>\nendobj\n`;
  body += '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n';

  for (let i = 0; i < pageCount; i += 1) {
    const pageNum = 4 + i * 2;
    const contentNum = 5 + i * 2;
    let stream = 'BT\n/F1 12 Tf\n';
    for (const line of pages[i]) {
      const escaped = line.text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      stream += `1 0 0 1 ${line.x} ${line.y} Tm (${escaped}) Tj\n`;
    }
    stream += 'ET\n';
    const streamBuf = Buffer.from(stream, 'latin1');

    body += `${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentNum} 0 R /Resources << /Font << /F1 3 0 R >> >> >>\nendobj\n`;
    body += `${contentNum} 0 obj\n<< /Length ${streamBuf.length} >>\nstream\n${stream}endstream\nendobj\n`;
  }

  const totalObjs = 3 + pageCount * 2;
  body += `xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`;
  body += `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n100\n%%EOF`;

  return Buffer.from(body, 'latin1');
}
