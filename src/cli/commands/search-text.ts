import type { SearchRequestIssue } from '@/application/dto/search-request';
import type { SearchByTextError, SearchStrategy, TextSearchDto } from '@/application/dto/search-result';
import { decomposeErrorLines } from '@/cli/commands/decompose';
import { isMissingVariables } from '@/cli/commands/missing-variables';
import { rankingLines } from '@/cli/commands/search';
import type { MissingVariables } from '@/composition/cli-container';
import { redactSecrets } from '@/shared/redact-secrets';
import type { Result } from '@/shared/result';

type SearchTextOutcome = Result<TextSearchDto, SearchByTextError | MissingVariables>;

export type RunSearchTextDeps = {
  request: string;
  strategy: SearchStrategy;
  searchByText: (request: string, strategy: SearchStrategy) => Promise<SearchTextOutcome>;
  print: (line: string) => void;
};

/** A rejection and a request with nothing to search are valid outcomes with no ranking, as in `decompose` (design D2). */
const NO_RANKING_EXIT_CODE = 3;

/** `ingest search-text "<request>"`: prints the structure as JSON, then the ranking. Returns the exit code. */
export async function runSearchText({ request, strategy, searchByText, print }: RunSearchTextDeps): Promise<number> {
  const result = await searchByText(request, strategy);
  const lines = result.ok ? resultLines(result.value) : errorLines(result.error);
  lines.forEach((line) => print(redactSecrets(line)));
  return exitCode(result);
}

function resultLines({ structure, result }: TextSearchDto): string[] {
  return [JSON.stringify(structure, null, 2), ...rankingLines(result)];
}

function errorLines(error: SearchByTextError | MissingVariables): string[] {
  if (isMissingVariables(error)) return decomposeErrorLines(error);
  switch (error.kind) {
    case 'nothing-to-search':
      return ['The request gives nothing to search: the model found no constraint in it.'];
    case 'invalid-request':
      return ['The structure is not a valid search:', ...error.issues.map(issueLine)];
    case 'index-not-loaded':
      return [error.message];
    case 'search-failed':
      return [`The search failed: ${error.reason}`];
    default:
      return decomposeErrorLines(error);
  }
}

function issueLine({ constraint, field, message }: SearchRequestIssue): string {
  const where = constraint === undefined ? field : `${constraint}.${field}`;
  return `  ${where}: ${message}`;
}

function exitCode(result: SearchTextOutcome): number {
  if (result.ok) return 0;
  return result.error.kind === 'rejected' || result.error.kind === 'nothing-to-search' ? NO_RANKING_EXIT_CODE : 1;
}
