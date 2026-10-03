import { isAbsolute, relative, resolve } from 'node:path';

/** Whether `path` resolves inside `dir`: the QA report must never be written outside the data directory. */
export const isInside = (dir: string, path: string): boolean => {
  const fromDir = relative(resolve(dir), resolve(path));
  return !fromDir.startsWith('..') && !isAbsolute(fromDir);
};
