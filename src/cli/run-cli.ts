/** Each command returns its exit code. */
export type CliCommands = {
  menu: () => Promise<number>;
  recipes: () => Promise<number>;
  migrate: () => Promise<number>;
  load: () => Promise<number>;
};

export type RunCliDeps = {
  /** Builds the commands, and with them the container: only called for a valid command. */
  createCommands: () => CliCommands;
  print: (line: string) => void;
};

const USAGE = [
  "Usage: pnpm ingest <menu|recipes|migrate|load>",
  "  menu     Ingest the weekly menus from data/raw/Dieta into data/menu-platos.json",
  "  recipes  Ingest the recipes from data/raw/Dieta into data/recetas.json",
  "  migrate  Apply the pending SQL migrations of postgres/migrations to the database",
  "  load     Load data/menu-platos.json, data/recetas.json and their embeddings into the database",
];

const COMMANDS: (keyof CliCommands)[] = ["menu", "recipes", "migrate", "load"];

const isCommand = (name: string | undefined): name is keyof CliCommands =>
  COMMANDS.includes(name as keyof CliCommands);

/** Dispatches the CLI arguments to a command. Returns the exit code: 2 on a usage error. */
export async function runCli(args: string[], { createCommands, print }: RunCliDeps): Promise<number> {
  const [command, ...rest] = args;
  if (!isCommand(command) || rest.length > 0) {
    USAGE.forEach(print);
    return 2;
  }
  return createCommands()[command]();
}
