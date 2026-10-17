import { accountCommands, type AccountRequest } from '@/composition/cli/account';
import { evaluationCommands } from '@/composition/cli/evaluation';
import { ingestCommands } from '@/composition/cli/ingest';
import type { Env, MissingVariables } from '@/composition/cli/requiring';
import { searchCommands } from '@/composition/cli/search';

export type { AccountRequest, MissingVariables };

/** Wires each CLI command to its use case and adapters. Reads `env` only when a command runs. */
export function createCliContainer(env: Env = {}) {
  return {
    ...ingestCommands(env),
    ...accountCommands(env),
    ...searchCommands(env),
    ...evaluationCommands(env),
  };
}
