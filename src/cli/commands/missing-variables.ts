import type { MissingVariables } from "@/composition/cli-container";

export const isMissingVariables = (error: { kind: string }): error is MissingVariables =>
  error.kind === "missing-variables";

export const missingLines = ({ names }: MissingVariables): string[] => [
  `Missing environment variable${names.length > 1 ? "s" : ""}: ${names.join(", ")}. Set them in .env.local.`,
];
