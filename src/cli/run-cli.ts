import type { SearchStrategy } from '@/application/dto/search-result';

/** What `search` runs with: the structure file and the strategy. */
export type SearchOptions = { file: string; strategy: SearchStrategy };

/** Each command receives the arguments after its name, or `search` its parsed options, and returns its exit code. */
export type CliCommands = {
  menu: () => Promise<number>;
  recipes: () => Promise<number>;
  migrate: () => Promise<number>;
  'shopping-list': () => Promise<number>;
  embed: () => Promise<number>;
  account: (args: string[]) => Promise<number>;
  search: (options: SearchOptions) => Promise<number>;
  'evaluate-search': () => Promise<number>;
};

export type RunCliDeps = {
  /** Builds the commands, and with them the container: only called for a valid command. */
  createCommands: () => CliCommands;
  print: (line: string) => void;
};

type ArgsCommand = Exclude<keyof CliCommands, 'search'>;

// How many arguments each command takes; anything else is a usage error before the container is built.
const ARGUMENTS: Record<ArgsCommand, { min: number; max: number }> = {
  migrate: { min: 0, max: 0 },
  recipes: { min: 0, max: 0 },
  menu: { min: 0, max: 0 },
  'shopping-list': { min: 0, max: 0 },
  embed: { min: 0, max: 0 },
  account: { min: 1, max: 2 },
  'evaluate-search': { min: 0, max: 0 },
};

// Listed in the order they are run (MF-41 design D9, MF-10 design D3): migrate → recipes → menu → shopping-list → embed.
const USAGE = [
  'Usage: pnpm ingest <migrate|recipes|menu|shopping-list|embed|account|search|evaluate-search>',
  '  migrate                 Apply the pending SQL migrations of postgres/migrations to the database',
  '  recipes                 Ingest the recipes from data/raw/Dieta into data/recetas.json and the database',
  '  menu                    Ingest the weekly menus from data/raw/Dieta into data/menu-platos.json and the database',
  '  shopping-list           Ingest the shopping lists from data/raw/Dieta into the database',
  '  embed                   Compute the missing or outdated recipe embeddings and store them in the database',
  '  account <email> [name]  Create an account; the password is asked at a prompt, or read from stdin',
  '  search <structure.json> Search the menus with a structure file [--strategy lexical|semantic|hybrid]',
  '  evaluate-search         Measure the three strategies against the golden sets into evals/search/results.md',
];

const STRATEGIES: SearchStrategy[] = ['lexical', 'semantic', 'hybrid'];
const DEFAULT_STRATEGY: SearchStrategy = 'hybrid';

/** Dispatches the CLI arguments to a command. Returns the exit code: 2 on a usage error. */
export async function runCli(args: string[], { createCommands, print }: RunCliDeps): Promise<number> {
  const [command, ...rest] = args;
  const search = command === 'search' ? searchOptions(rest) : null;
  if (search) return createCommands().search(search);
  if (isArgsCommand(command) && takesArguments(command, rest)) return createCommands()[command](rest);
  USAGE.forEach(print);
  return 2;
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

function isArgsCommand(name: string | undefined): name is ArgsCommand {
  return name !== undefined && Object.hasOwn(ARGUMENTS, name);
}

function takesArguments(command: ArgsCommand, args: string[]): boolean {
  const { min, max } = ARGUMENTS[command];
  return args.length >= min && args.length <= max;
}
