import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { SearchRequestDto } from '@/application/dto/search-request';
import type {
  ExpectedStructure,
  GoldenSetError,
  GoldenSets,
  GoldenSetSource,
  GradedQuery,
} from '@/application/ports/golden-set-source';
import { err, ok, type Result } from '@/shared/result';

const RETRIEVAL_FILE = 'retrieval/golden-set.json';
const DECOMPOSER_FILE = 'decomposer/golden-set.json';

/** The keys of a decomposer request that are for the evaluation, not for the search. */
const GOLDEN_SET_METADATA = ['id', 'text', 'origin'];

// Only what the evaluation reads is checked; the structure is validated as a search by the use case.
const retrievalSchema = z.object({
  queries: z.array(
    z.object({
      id: z.string().min(1),
      type: z.enum(['literal', 'exclusion', 'attribute', 'fuzzy', 'combined']),
      status: z.enum(['kept', 'withdrawn']),
      // A withdrawn query was never graded; a kept one without grades is stopped by the use case.
      grades: z.record(z.string().regex(/^\d+$/), z.union([z.literal(0), z.literal(1), z.literal(2)])).optional(),
    }),
  ),
});

const decomposerSchema = z.array(z.looseObject({ id: z.string().min(1) }));

/** Reads the retrieval (MF-12) and decomposer (MF-13) golden sets from `<evalsDir>`, the `evals/` folder of the repository. */
export class FileGoldenSetSource implements GoldenSetSource {
  constructor(private readonly evalsDir: string) {}

  async read(): Promise<Result<GoldenSets, GoldenSetError>> {
    const retrieval = await this.parse(RETRIEVAL_FILE, retrievalSchema);
    if (!retrieval.ok) return retrieval;
    const decomposer = await this.parse(DECOMPOSER_FILE, decomposerSchema);
    if (!decomposer.ok) return decomposer;
    return ok({ queries: retrieval.value.queries.map(toGradedQuery), structures: decomposer.value.map(toExpectedStructure) });
  }

  private async parse<T>(file: string, schema: z.ZodType<T>): Promise<Result<T, GoldenSetError>> {
    const invalid = (reason: string) => err({ kind: 'golden-set-invalid' as const, file: `evals/${file}`, reason });
    let content: string;
    try {
      content = await readFile(join(this.evalsDir, file), 'utf8');
    } catch (error) {
      return invalid(`cannot read the file: ${messageOf(error)}`);
    }
    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch (error) {
      return invalid(`not JSON: ${messageOf(error)}`);
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return invalid(firstIssue(parsed.error.issues));
    return ok(parsed.data);
  }
}

function toGradedQuery({ id, type, status, grades }: z.output<typeof retrievalSchema>['queries'][number]): GradedQuery {
  return { id, type, status, grades: new Map(Object.entries(grades ?? {}).map(([menu, grade]) => [Number(menu), grade])) };
}

function toExpectedStructure(request: z.output<typeof decomposerSchema>[number]): ExpectedStructure {
  const structure = Object.fromEntries(Object.entries(request).filter(([key]) => !GOLDEN_SET_METADATA.includes(key)));
  return { id: request.id, structure: structure as SearchRequestDto };
}

function firstIssue([issue]: z.core.$ZodIssue[]): string {
  return `${issue.path.join('.') || 'the file'}: ${issue.message}`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
