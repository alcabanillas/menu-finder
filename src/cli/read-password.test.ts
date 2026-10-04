import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { readPassword } from '@/cli/read-password';

class FakeTerminal extends PassThrough {
  isTTY = true;
  rawModes: boolean[] = [];
  setRawMode(mode: boolean) {
    this.rawModes.push(mode);
    return this;
  }
}

const collect = (stream: PassThrough) => {
  let text = '';
  stream.on('data', (chunk) => (text += String(chunk)));
  return () => text;
};

describe('readPassword from stdin', () => {
  const fromStdin = async (text: string) => {
    const input = new PassThrough();
    input.end(text);
    const output = new PassThrough();
    const written = collect(output);
    return { password: await readPassword({ input, output }), written: written() };
  };

  it('reads the first line', async () => {
    expect((await fromStdin('a-long-enough-pass\nsecond line\n')).password).toBe('a-long-enough-pass');
  });

  it('drops the carriage return of a Windows line ending', async () => {
    expect((await fromStdin('a-long-enough-pass\r\n')).password).toBe('a-long-enough-pass');
  });

  it('keeps spaces inside the password', async () => {
    expect((await fromStdin('  two words  \n')).password).toBe('  two words  ');
  });

  it('gives an empty password when stdin is closed or the line is empty', async () => {
    expect((await fromStdin('')).password).toBe('');
    expect((await fromStdin('\n')).password).toBe('');
  });

  it('writes no prompt when stdin is not a terminal', async () => {
    expect((await fromStdin('a-long-enough-pass\n')).written).toBe('');
  });
});

describe('readPassword at a terminal', () => {
  const start = () => {
    const input = new FakeTerminal();
    const output = new PassThrough();
    const written = collect(output);
    return { input, written, result: readPassword({ input, output }) };
  };

  it('reads what is typed up to the Enter key, without echoing it', async () => {
    const { input, written, result } = start();

    input.write('s3cret');
    input.write('\r');

    expect(await result).toBe('s3cret');
    expect(written()).not.toContain('s3cret');
    expect(written()).toContain('Password');
  });

  it.each([
    ['applies the backspace key', 's3cr\u007fet\r', 's3cet'],
    ['reads a pasted password that arrives in one chunk with the Enter key', 'a-long-enough-pass\n', 'a-long-enough-pass'],
    ['ignores the other control keys, such as Ctrl+D', 's3\u0004cr\u0001et\r', 's3cret'],
  ])('%s', async (_, typed, password) => {
    const { input, result } = start();

    input.write(typed);

    expect(await result).toBe(password);
  });

  it('ignores the arrow, Home, End and Delete keys', async () => {
    const { input, result } = start();

    input.write('s3c');
    input.write('\u001b[D');
    input.write('\u001b[H');
    input.write('\u001b[3~');
    input.write('\u001bOF');
    input.write('ret\r');

    expect(await result).toBe('s3cret');
  });

  it('turns the raw mode on while it reads and back off afterwards', async () => {
    const { input, result } = start();

    input.write('x\r');
    await result;

    expect(input.rawModes).toEqual([true, false]);
  });

  it('is cancelled by Ctrl+C, and restores the terminal', async () => {
    const { input, result } = start();

    input.write('abc\u0003');

    await expect(result).rejects.toThrow('Cancelled');
    expect(input.rawModes).toEqual([true, false]);
  });
});
