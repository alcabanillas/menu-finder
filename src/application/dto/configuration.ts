/** Environment variables a command needs and that are not set. Checked before connecting to anything. */
export type MissingVariables = { kind: "missing-variables"; names: string[] };
