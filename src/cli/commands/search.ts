import type { SearchRequestDto } from '@/application/dto/search-request';
import type { SearchMenusError, SearchResultDto, SearchStrategy } from '@/application/dto/search-result';
import { isMissingVariables, missingLines } from '@/cli/commands/missing-variables';
import type { MissingVariables } from '@/composition/cli-container';
import { redactSecrets } from '@/shared/redact-secrets';
import type { Result } from '@/shared/result';

type Print = (line: string) => void;

type SearchOutcome = Result<SearchResultDto, SearchMenusError | MissingVariables>;

export type RunSearchDeps = {
  file: string;
  strategy: SearchStrategy;
  readFile: (path: string) => Promise<string>;
  searchMenus: (dto: SearchRequestDto, strategy: SearchStrategy) => Promise<SearchOutcome>;
  print: Print;
};

/** The keys of a golden-set request that are for the evaluation, not for the search (spec menu-search). */
const GOLDEN_SET_METADATA = ['id', 'text', 'origin'];

const SCORE_DECIMALS = 3;

/** `ingest search <structure.json>`: runs a search and prints the ranking. Returns the exit code. */
export async function runSearch({ file, strategy, readFile, searchMenus, print }: RunSearchDeps): Promise<number> {
  const structure = await readStructure(file, readFile);
  if (!structure.ok) {
    print(structure.error);
    return 1;
  }
  const result = await searchMenus(structure.value, strategy);
  const lines = result.ok ? resultLines(result.value) : errorLines(file, result.error);
  lines.forEach((line) => print(redactSecrets(line)));
  return result.ok ? 0 : 1;
}

// The use case validates the structure; here it is only read, and a golden-set request loses its metadata.
async function readStructure(
  file: string,
  readFile: RunSearchDeps['readFile'],
): Promise<Result<SearchRequestDto, string>> {
  let content: string;
  try {
    content = await readFile(file);
  } catch (error) {
    return { ok: false, error: `Cannot read ${file}: ${messageOf(error)}` };
  }
  try {
    return { ok: true, value: withoutGoldenSetMetadata(JSON.parse(content)) as SearchRequestDto };
  } catch (error) {
    return { ok: false, error: `${file} is not JSON: ${messageOf(error)}` };
  }
}

function withoutGoldenSetMetadata(parsed: unknown): unknown {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return parsed;
  return Object.fromEntries(Object.entries(parsed).filter(([key]) => !GOLDEN_SET_METADATA.includes(key)));
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resultLines({ strategy, menus, tiedWithFirst, removedBy }: SearchResultDto): string[] {
  return [
    `Search with the ${strategy} strategy: ${menus.length} menus.`,
    ...(menus.length === 0 ? ['No menu is ranked.'] : menus.flatMap(menuLines)),
    `Menus tied with the first: ${tiedWithFirst}`,
    ...(removedBy.length === 0
      ? ['No hard constraint.']
      : removedBy.map(({ constraints, menusRemoved }) => `Hard constraint ${constraints.join('+')} removes ${menusRemoved} menus.`)),
  ];
}

function menuLines({ menu, score, evidence }: SearchResultDto['menus'][number], index: number): string[] {
  return [
    `${index + 1}. Menu ${menu}, score ${score.toFixed(SCORE_DECIMALS)}`,
    ...evidence.map(({ constraints, dish }) => {
      const where = dish ? `${dish.name} (${dish.day} ${dish.meal})` : 'no dish';
      return `   ${constraints.join('+')}: ${where}`;
    }),
  ];
}

function errorLines(file: string, error: SearchMenusError | MissingVariables): string[] {
  if (isMissingVariables(error)) return missingLines(error);
  switch (error.kind) {
    case 'invalid-request':
      return [`${file} is not a valid search structure:`, ...error.issues.map(issueLine)];
    case 'index-not-loaded':
      return [error.message];
    case 'search-failed':
      return [`The search failed: ${error.reason}`];
  }
}

function issueLine({ constraint, field, message }: { constraint?: string; field: string; message: string }): string {
  const where = constraint === undefined ? field : `${constraint}.${field}`;
  return `  ${where}: ${message}`;
}
