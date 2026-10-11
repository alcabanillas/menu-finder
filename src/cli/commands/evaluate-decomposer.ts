import type {
  ConstraintText,
  CountRow,
  DecomposerEvaluation,
  DecomposerReport,
  EvaluateDecomposerError,
  ModelReport,
  RequestDetail,
} from '@/application/dto/decomposer-evaluation';
import { isMissingVariables, missingLines } from '@/cli/commands/missing-variables';
import type { MissingVariables } from '@/composition/cli-container';
import { redactSecrets } from '@/shared/redact-secrets';
import type { Result } from '@/shared/result';

type EvaluationOutcome = Result<DecomposerEvaluation, EvaluateDecomposerError | MissingVariables>;

export type RunEvaluateDecomposerDeps = {
  evaluateDecomposer: () => Promise<EvaluationOutcome>;
  reportPath: string;
  writeFile: (path: string, content: string) => Promise<void>;
  print: (line: string) => void;
};

const DECIMALS = 3;
const NO_VALUE = '–';

/**
 * `ingest evaluate-decomposer`: measures each model against the decomposer golden set, prints the misses with their
 * terms and writes the report, which holds ids and numbers only (MF-40.3 design D5).
 */
export async function runEvaluateDecomposer({
  evaluateDecomposer,
  reportPath,
  writeFile,
  print,
}: RunEvaluateDecomposerDeps): Promise<number> {
  const result = await evaluateDecomposer();
  if (!result.ok) {
    errorLines(result.error).forEach((line) => print(redactSecrets(line)));
    return 1;
  }
  result.value.details.forEach((detail) => print(redactSecrets(detailLine(detail))));
  await writeFile(reportPath, reportMarkdown(result.value.report));
  print(`Report written to ${reportPath}.`);
  return 0;
}

function errorLines(error: EvaluateDecomposerError | MissingVariables): string[] {
  if (isMissingVariables(error)) return missingLines(error);
  return [`The golden set ${error.file} cannot be used: ${error.reason}`];
}

// The console is local, so it may name the terms; the report never does.
function detailLine({ id, model, expected, answer, notFound, missed }: RequestDetail): string {
  return [
    `${id} ${model}: expected ${expected}, answer ${answer}`,
    ...(notFound.length > 0 ? [`not found: ${notFound.map(constraintText).join(', ')}`] : []),
    ...(missed.length > 0 ? [`missed: ${missed.map(constraintText).join(', ')}`] : []),
  ].join('; ');
}

function constraintText({ term, type, polarity }: ConstraintText): string {
  return `${term} (${type}, ${polarity})`;
}

function reportMarkdown({ requests, models }: DecomposerReport): string {
  return [
    '# Decomposer evaluation (MF-40.3)',
    '',
    'Written by `pnpm ingest evaluate-decomposer` (spec decomposer-evaluation). Model names, request ids and numbers only.',
    '',
    `One run per model over the ${requests} requests of \`evals/decomposer/golden-set.json\`. A constraint is a hit when its term (exact, lowercased), type and polarity match an expected constraint of the same request, one to one. Each cell gives precision (P) and recall (R), then the counts: hits / answered / expected. Small counts are small samples.`,
    '',
    '## Constraints',
    '',
    ...table('Type', models, (model) => model.constraints.map((row) => [row.kind, countCell(row)])),
    '',
    '## Hard and slot, over the hits',
    '',
    ...table('Field', models, ({ hard, slot }) => [
      ['hard', shareCell(hard)],
      ['slot', shareCell(slot)],
    ]),
    '',
    '## Groups',
    '',
    ...table('Group', models, (model) => model.groups.map((row) => [row.kind, countCell(row)])),
    '',
    '## Rejections',
    '',
    ...table('Category', models, (model) => [
      ...model.rejections.map(({ category, hits, total }): [string, string] => [category, `${hits}/${total}`]),
      ['search requests rejected by mistake', idsCell(model.rejectedSearches)],
    ]),
    '',
    '## Invalid answers and failed calls',
    '',
    'Both count as an answer with no constraints.',
    '',
    ...table('Outcome', models, ({ invalidAnswers, failedCalls }) => [
      ['invalid answers', idsCell(invalidAnswers)],
      ['failed calls', idsCell(failedCalls)],
    ]),
    '',
    '## Latency of one decomposition',
    '',
    ...table('Measure', models, ({ latency }) => [
      ['mean', millisecondsCell(latency.meanMs)],
      ['maximum', millisecondsCell(latency.maxMs)],
    ]),
    '',
  ].join('\n');
}

// One row per label, one column per model; every model gives the same labels in the same order.
function table(label: string, models: ModelReport[], rowsOf: (model: ModelReport) => [string, string][]): string[] {
  const columns = models.map(rowsOf);
  const labels = columns[0]?.map(([name]) => name) ?? [];
  return [
    `| ${label} | ${models.map(({ model }) => model).join(' | ')} |`,
    `|---|${models.map(() => '---').join('|')}|`,
    ...labels.map((name, index) => `| ${name} | ${columns.map((rows) => rows[index][1]).join(' | ')} |`),
  ];
}

function countCell({ hits, answered, expected, precision, recall }: CountRow<unknown>): string {
  return `P ${formatted(precision)} · R ${formatted(recall)} (${hits}/${answered}/${expected})`;
}

function shareCell({ matching, of, share }: ModelReport['hard']): string {
  return `${formatted(share)} (${matching}/${of})`;
}

function idsCell(ids: string[]): string {
  return ids.length === 0 ? '0' : `${ids.length} (${ids.join(', ')})`;
}

function millisecondsCell(value: number | null): string {
  return value === null ? NO_VALUE : `${Math.round(value)} ms`;
}

function formatted(value: number | null): string {
  return value === null ? NO_VALUE : value.toFixed(DECIMALS);
}
