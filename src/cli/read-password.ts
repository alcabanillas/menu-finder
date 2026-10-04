import { createInterface } from 'node:readline';

export type PasswordStreams = {
  input: NodeJS.ReadableStream & { isTTY?: boolean; setRawMode?: (mode: boolean) => unknown };
  /** The prompt goes here; the CLI passes stderr, so that stdout carries only the result. */
  output: NodeJS.WritableStream;
};

const ENTER = new Set(['\r', '\n']);
const BACKSPACE = new Set(['\u007f', '\b']);
const CTRL_C = '\u0003';

/**
 * Reads the password of `ingest account`: typed with no echo when stdin is a terminal, the first line of stdin
 * otherwise (a pipe, the demo account). It is never an argument or an environment variable. Empty when stdin ends first.
 */
export function readPassword({ input, output }: PasswordStreams): Promise<string> {
  return input.isTTY && input.setRawMode ? typeWithoutEcho(input, output) : readFirstLine(input);
}

async function typeWithoutEcho(input: PasswordStreams['input'], output: PasswordStreams['output']): Promise<string> {
  output.write('Password: ');
  input.setRawMode?.(true);
  try {
    return await typeUntilEnter(input);
  } finally {
    input.setRawMode?.(false);
    output.write('\n');
  }
}

// In raw mode the terminal sends each key as it is pressed and echoes nothing, so the backspace is ours to apply.
async function typeUntilEnter(input: AsyncIterable<unknown>): Promise<string> {
  let typed = '';
  for await (const chunk of input) {
    for (const key of String(chunk)) {
      if (ENTER.has(key)) return typed;
      if (key === CTRL_C) throw new Error('Cancelled');
      typed = BACKSPACE.has(key) ? typed.slice(0, -1) : typed + key;
    }
  }
  return typed;
}

async function readFirstLine(input: NodeJS.ReadableStream): Promise<string> {
  const lines = createInterface({ input, crlfDelay: Infinity });
  try {
    for await (const line of lines) return line;
    return '';
  } finally {
    lines.close();
  }
}
