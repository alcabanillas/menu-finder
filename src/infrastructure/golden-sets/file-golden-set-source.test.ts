import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileGoldenSetSource } from '@/infrastructure/golden-sets/file-golden-set-source';
import { err, ok } from '@/shared/result';

const RETRIEVAL = {
  description: 'test',
  grades: { 0: 'not relevant', 1: 'partially relevant', 2: 'highly relevant' },
  menuCount: 2,
  queries: [
    { id: 'L01', type: 'literal', text: 'q1', origin: 'llm-blind', status: 'kept', grades: { 1: 2, 2: 0 } },
    { id: 'E01', type: 'exclusion', text: 'q2', origin: 'llm-blind', status: 'withdrawn', grades: { 1: 0, 2: 1 } },
  ],
};

const CONSTRAINT = { id: 'c1', type: 'literal', term: 'term', polarity: 'include', hard: false };

const DECOMPOSER = [
  { id: 'L01', text: 'q1', origin: 'retrieval-golden-set', constraints: [CONSTRAINT], sameDish: [], anyOf: [] },
];

describe('FileGoldenSetSource', () => {
  let evalsDir: string;

  beforeEach(async () => {
    evalsDir = await mkdtemp(join(tmpdir(), 'golden-sets-'));
    await mkdir(join(evalsDir, 'retrieval'));
    await mkdir(join(evalsDir, 'decomposer'));
  });
  afterEach(async () => {
    await rm(evalsDir, { recursive: true, force: true });
  });

  async function write(retrieval: unknown, decomposer: unknown) {
    await writeFile(join(evalsDir, 'retrieval', 'golden-set.json'), JSON.stringify(retrieval), 'utf8');
    await writeFile(join(evalsDir, 'decomposer', 'golden-set.json'), JSON.stringify(decomposer), 'utf8');
  }

  it('reads the graded queries and the expected structures without the golden-set metadata', async () => {
    await write(RETRIEVAL, DECOMPOSER);

    expect(await new FileGoldenSetSource(evalsDir).read()).toEqual(
      ok({
        queries: [
          { id: 'L01', type: 'literal', status: 'kept', grades: new Map([[1, 2], [2, 0]]) },
          { id: 'E01', type: 'exclusion', status: 'withdrawn', grades: new Map([[1, 0], [2, 1]]) },
        ],
        structures: [{ id: 'L01', structure: { constraints: [CONSTRAINT], sameDish: [], anyOf: [] } }],
      }),
    );
  });

  it('reads a withdrawn query that has no grades, with no grade', async () => {
    const withdrawn = { id: 'E01', type: 'exclusion', text: 'q2', origin: 'llm-blind', status: 'withdrawn' };
    await write({ ...RETRIEVAL, queries: [withdrawn] }, DECOMPOSER);

    const result = await new FileGoldenSetSource(evalsDir).read();

    expect(result.ok && result.value.queries).toEqual([{ id: 'E01', type: 'exclusion', status: 'withdrawn', grades: new Map() }]);
  });

  it('names the file that is missing', async () => {
    await writeFile(join(evalsDir, 'retrieval', 'golden-set.json'), JSON.stringify(RETRIEVAL), 'utf8');

    expect(await new FileGoldenSetSource(evalsDir).read()).toEqual(
      err({ kind: 'golden-set-invalid', file: 'evals/decomposer/golden-set.json', reason: expect.stringContaining('cannot read') }),
    );
  });

  it('names the file that is not JSON', async () => {
    await write(RETRIEVAL, DECOMPOSER);
    await writeFile(join(evalsDir, 'retrieval', 'golden-set.json'), '{ not json', 'utf8');

    expect(await new FileGoldenSetSource(evalsDir).read()).toEqual(
      err({ kind: 'golden-set-invalid', file: 'evals/retrieval/golden-set.json', reason: expect.stringContaining('not JSON') }),
    );
  });

  it('names the first invalid path of a retrieval golden set with the wrong shape', async () => {
    const wrongGrade = { ...RETRIEVAL, queries: [{ ...RETRIEVAL.queries[0], grades: { 1: 2, 2: 5 } }] };
    await write(wrongGrade, DECOMPOSER);

    expect(await new FileGoldenSetSource(evalsDir).read()).toEqual(
      err({ kind: 'golden-set-invalid', file: 'evals/retrieval/golden-set.json', reason: expect.stringContaining('queries.0.grades.2') }),
    );
  });

  it('names the first invalid path of a decomposer golden set with the wrong shape', async () => {
    await write(RETRIEVAL, [{ text: 'no id' }]);

    expect(await new FileGoldenSetSource(evalsDir).read()).toEqual(
      err({ kind: 'golden-set-invalid', file: 'evals/decomposer/golden-set.json', reason: expect.stringContaining('0.id') }),
    );
  });
});
