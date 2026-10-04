import type { SearchStrategy } from '@/application/dto/search-result';

/** What `search` runs with: the structure file and the strategy. */
export type SearchOptions = { file: string; strategy: SearchStrategy };

/** Each command returns its exit code. */
export type CliCommands = {
  menu: () => Promise<number>;
  recipes: () => Promise<number>;
  migrate: () => Promise<number>;
  embed: () => Promise<number>;
  search: (options: SearchOptions) => Promise<number>;
};

export type RunCliDeps = {
  /** Builds the commands, and with them the container: only called for a valid command. */
  createCommands: () => CliCommands;
  print: (line: string) => void;
};

// Listed in the order they are run (MF-41 design D9): a dish points to its recipe row.
const USAGE = [
  'Usage: pnpm ingest <migrate|recipes|menu|embed|search>',
  '  migrate  Apply the pending SQL migrations of postgres/migrations to the database',
  '  recipes  Ingest the recipes from data/raw/Dieta into data/recetas.json and the database',
  '  menu     Ingest the weekly menus from data/raw/Dieta into data/menu-platos.json and the database',
  '  embed    Compute the missing or outdated recipe embeddings and store them in the database',
  '  search   Search the menus with a structure file: search <structure.json> [--strategy lexical|semantic|hybrid]',
];

type PlainCommand = Exclude<keyof CliCommands, 'search'>;

const PLAIN_COMMANDS: PlainCommand[] = ['migrate', 'recipes', 'menu', 'embed'];
const STRATEGIES: SearchStrategy[] = ['lexical', 'semantic', 'hybrid'];
const DEFAULT_STRATEGY: SearchStrategy = 'hybrid';

/** Dispatches the CLI arguments to a command. Returns the exit code: 2 on a usage error. */
export async function runCli(args: string[], { createCommands, print }: RunCliDeps): Promise<number> {
  const [command, ...rest] = args;
  if (isPlainCommand(command) && rest.length === 0) return createCommands()[command]();
  const search = command === 'search' ? searchOptions(rest) : null;
  if (search) return createCommands().search(search);
  USAGE.forEach(print);
  return 2;
}

function isPlainCommand(name: string | undefined): name is PlainCommand {
  return PLAIN_COMMANDS.includes(name as PlainCommand);
}

// `<file>` or `<file> --strategy <name>`; anything else is a usage error.
function searchOptions([file, flag, strategy, ...extra]: string[]): SearchOptions | null {
  if (file === undefined || file.startsWith('--') || extra.length > 0) return null;
  if (flag === undefined) return { file, strategy: DEFAULT_STRATEGY };
  return flag === '--strategy' && isStrategy(strategy) ? { file, strategy } : null;
}

function isStrategy(name: string | undefined): name is SearchStrategy {
  return STRATEGIES.includes(name as SearchStrategy);
}
