import { join } from 'node:path';
import { evaluateDecomposer } from '@/application/use-cases/evaluation/evaluate-decomposer';
import { evaluateSearch } from '@/application/use-cases/evaluation/evaluate-search';
import { createGenkitEmbeddings } from '@/infrastructure/genkit/genkit-embeddings';
import {
  createGenkitRequestDecomposer,
  DECOMPOSER_MODEL,
  type ThinkingLevel,
} from '@/infrastructure/genkit/genkit-request-decomposer';
import { FileGoldenSetSource } from '@/infrastructure/golden-sets/file-golden-set-source';
import { REPO_ROOT } from './repo-root';
import { DATABASE_URL, GEMINI_API_KEY, requiring, type Env } from './requiring';
import { searchPorts } from './search-ports';
import { withPool } from './with-pool';

// The Lite model the decomposer started with, with `MINIMAL` and `LOW` thinking, then the model of the decomposer,
// `gemini-3.8-flash`, which answers `MINIMAL` with HTTP 400 (MF-40.3 design D4, task 6.1). The author chose Flash on
// 2026-10-12; Lite stays in the report as the comparison behind that choice.
const LITE_MODEL = 'gemini-3.5-flash-lite';
const EVALUATED_MODELS: { model: string; thinkingLevel: ThinkingLevel }[] = [
  { model: LITE_MODEL, thinkingLevel: 'MINIMAL' },
  { model: LITE_MODEL, thinkingLevel: 'LOW' },
  { model: DECOMPOSER_MODEL, thinkingLevel: 'LOW' },
];

/** Evaluation commands wired to golden sets and evaluated models. */
export function evaluationCommands(env: Env) {
  return {
    searchReportPath: join(REPO_ROOT, 'evals', 'search', 'results.md'),
    decomposerReportPath: join(REPO_ROOT, 'evals', 'decomposer', 'results.md'),
    // The key only, no database (spec decomposer-evaluation): one decomposer per evaluated model.
    evaluateDecomposer: () =>
      requiring(env, [GEMINI_API_KEY], ([apiKey]) =>
        evaluateDecomposer({
          goldenSets: new FileGoldenSetSource(join(REPO_ROOT, 'evals')),
          models: EVALUATED_MODELS.map(({ model, thinkingLevel }) => ({
            model: `${model}, thinking ${thinkingLevel}`,
            decomposer: createGenkitRequestDecomposer(apiKey, model, thinkingLevel),
          })),
          now: () => performance.now(),
        }),
      ),
    // Read only: the three strategies, so the key is always needed (spec search-evaluation).
    evaluateSearch: () =>
      requiring(env, [DATABASE_URL, GEMINI_API_KEY], ([url, apiKey]) =>
        withPool(url, (pool) =>
          evaluateSearch({
            goldenSets: new FileGoldenSetSource(join(REPO_ROOT, 'evals')),
            ...searchPorts(pool, createGenkitEmbeddings(apiKey)),
          }),
        ),
      ),
  };
}
