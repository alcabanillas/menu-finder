/** Each command returns its exit code. */
export type CliCommands = { menu: () => Promise<number> };

export type RunCliDeps = {
  /** Builds the commands, and with them the container: only called for a valid command. */
  createCommands: () => CliCommands;
  print: (line: string) => void;
};

const USAGE = ["Usage: pnpm ingest menu", "  menu  Ingest the weekly menus from data/raw/Dieta into data/menu-platos.json"];

/** Dispatches the CLI arguments to a command. Returns the exit code: 2 on a usage error. */
export async function runCli(args: string[], { createCommands, print }: RunCliDeps): Promise<number> {
  const [command, ...rest] = args;
  if (command !== "menu" || rest.length > 0) {
    USAGE.forEach(print);
    return 2;
  }
  return createCommands().menu();
}
