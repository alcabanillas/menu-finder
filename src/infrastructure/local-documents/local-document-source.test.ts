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
});
