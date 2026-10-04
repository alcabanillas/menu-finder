/** Each command receives the arguments after its name and returns its exit code. */
export type CliCommands = {
  menu: () => Promise<number>;
  recipes: () => Promise<number>;
  migrate: () => Promise<number>;
  embed: () => Promise<number>;
  account: (args: string[]) => Promise<number>;
};

export type RunCliDeps = {
  /** Builds the commands, and with them the container: only called for a valid command. */
  createCommands: () => CliCommands;
  print: (line: string) => void;
};

// How many arguments each command takes; anything else is a usage error before the container is built.
const ARGUMENTS: Record<keyof CliCommands, { min: number; max: number }> = {
  migrate: { min: 0, max: 0 },
  recipes: { min: 0, max: 0 },
  menu: { min: 0, max: 0 },
  embed: { min: 0, max: 0 },
  account: { min: 1, max: 2 },
};

// Listed in the order they are run (MF-41 design D9): a dish points to its recipe row.
const USAGE = [
  'Usage: pnpm ingest <migrate|recipes|menu|embed|account>',
  '  migrate                Apply the pending SQL migrations of postgres/migrations to the database',
  '  recipes                Ingest the recipes from data/raw/Dieta into data/recetas.json and the database',
  '  menu                   Ingest the weekly menus from data/raw/Dieta into data/menu-platos.json and the database',
  '  embed                  Compute the missing or outdated recipe embeddings and store them in the database',
  '  account <email> [name] Create an account; the password is asked at a prompt, or read from stdin',
];

/** Dispatches the CLI arguments to a command. Returns the exit code: 2 on a usage error. */
export async function runCli(args: string[], { createCommands, print }: RunCliDeps): Promise<number> {
  const [command, ...rest] = args;
  if (!isCommand(command) || !takesArguments(command, rest)) {
    USAGE.forEach(print);
    return 2;
  }
  return createCommands()[command](rest);
}

function isCommand(name: string | undefined): name is keyof CliCommands {
  return name !== undefined && Object.hasOwn(ARGUMENTS, name);
}

function takesArguments(command: keyof CliCommands, args: string[]): boolean {
  const { min, max } = ARGUMENTS[command];
  return args.length >= min && args.length <= max;
}
