// `postgres://user:password@host` → `postgres://***@host`.
const CONNECTION_CREDENTIALS = /(postgres(?:ql)?:\/\/)[^@\s/]+@/g;

/** Removes connection-string credentials and the given secret values from a text that may be printed. */
export function redactSecrets(text: string, secrets: (string | undefined)[] = []): string {
  let redacted = text.replace(CONNECTION_CREDENTIALS, "$1***@");
  for (const secret of secrets) {
    if (secret) redacted = redacted.split(secret).join("***");
  }
  return redacted;
}
