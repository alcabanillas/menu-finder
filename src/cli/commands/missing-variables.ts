import type { MissingVariables } from '@/composition/cli-container';

/** Whether a command failed before running because environment variables are missing. */
export const isMissingVariables = (error: { kind: string }): error is MissingVariables =>
  error.kind === 'missing-variables';

/** The message that names the missing variables and where to set them. */
export const missingLines = ({ names }: MissingVariables): string[] => [
  `Missing environment variable${names.length > 1 ? 's' : ''}: ${names.join(', ')}. Set them in .env.local.`,
];
