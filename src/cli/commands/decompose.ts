import type { DecomposeError } from '@/application/dto/decomposition';
import type { SearchRequestDto, SearchRequestIssue } from '@/application/dto/search-request';
import { isMissingVariables, missingLines } from '@/cli/commands/missing-variables';
import type { MissingVariables } from '@/composition/cli-container';
import { redactSecrets } from '@/shared/redact-secrets';
import type { Result } from '@/shared/result';

type DecomposeOutcome = Result<SearchRequestDto, DecomposeError | MissingVariables>;

export type RunDecomposeDeps = {
  request: string;
  decomposeRequest: (request: string) => Promise<DecomposeOutcome>;
  print: (line: string) => void;
};

/** A rejection is a valid outcome, not a failure: its own code, so a script can tell them apart (MF-40.2 design D8). */
const REJECTED_EXIT_CODE = 3;

/** `ingest decompose "<request>"`: prints the structure as JSON, or the rejection with its category. Returns the exit code. */
export async function runDecompose({ request, decomposeRequest, print }: RunDecomposeDeps): Promise<number> {
  const result = await decomposeRequest(request);
  const lines = result.ok ? [JSON.stringify(result.value, null, 2)] : decomposeErrorLines(result.error);
  lines.forEach((line) => print(redactSecrets(line)));
  return exitCode(result);
}

/** The lines of a decomposition that gives no structure, or of a missing variable. */
export function decomposeErrorLines(error: DecomposeError | MissingVariables): string[] {
  if (isMissingVariables(error)) return missingLines(error);
  switch (error.kind) {
    case 'rejected':
      return [`The request is not a search for menus: ${error.category}`];
    case 'request-too-short':
      return ['The request is empty.'];
    case 'request-too-long':
      return [`The request is longer than ${error.max} characters.`];
    case 'invalid-answer':
      return ["The model's answer is not a valid search structure:", ...error.issues.map(issueLine)];
    case 'decomposer-failed':
      return [`The decomposer failed: ${error.reason}`];
  }
}

function issueLine({ constraint, field, message }: SearchRequestIssue): string {
  const where = constraint === undefined ? field : `${constraint}.${field}`;
  return `  ${where}: ${message}`;
}

function exitCode(result: DecomposeOutcome): number {
  if (result.ok) return 0;
  return result.error.kind === 'rejected' ? REJECTED_EXIT_CODE : 1;
}
