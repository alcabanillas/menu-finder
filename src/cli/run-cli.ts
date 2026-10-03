/** Each command returns its exit code. */
export type CliCommands = {
  menu: () => Promise<number>;
  recipes: () => Promise<number>;
  migrate: () => Promise<number>;
  embed: () => Promise<number>;
};

export type RunCliDeps = {
  /** Builds the commands, and with them the container: only called for a valid command. */
  createCommands: () => CliCommands;
  print: (line: string) => void;
};

// Listed in the order they are run (MF-41 design D9): a dish points to its recipe row.
const USAGE = [
  'Usage: pnpm ingest <migrate|recipes|menu|embed>',
  '  migrate  Apply the pending SQL migrations of postgres/migrations to the database',
  '  recipes  Ingest the recipes from data/raw/Dieta into data/recetas.json and the database',
  '  menu     Ingest the weekly menus from data/raw/Dieta into data/menu-platos.json and the database',
  '  embed    Compute the missing or outdated recipe embeddings and store them in the database',
];

const COMMANDS: (keyof CliCommands)[] = ['migrate', 'recipes', 'menu', 'embed'];

/** Dispatches the CLI arguments to a command. Returns the exit code: 2 on a usage error. */
export async function runCli(args: string[], { createCommands, print }: RunCliDeps): Promise<number> {
  const [command, ...rest] = args;
  if (!isCommand(command) || rest.length > 0) {
    USAGE.forEach(print);
    return 2;
  }
  return createCommands()[command]();
}

function isCommand(name: string | undefined): name is keyof CliCommands {
  return COMMANDS.includes(name as keyof CliCommands);
}
