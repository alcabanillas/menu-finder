import { fileURLToPath } from 'node:url';

/** Resolved from this file, not from `process.cwd()`, so the CLI reads and writes the same folders wherever it runs. */
export const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
