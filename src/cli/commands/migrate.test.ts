import { describe, expect, it } from "vitest";
import type { MigrateError, MigrateSummary } from "@/application/use-cases/migrate";
import { runMigrate } from "@/cli/commands/migrate";
import type { MissingVariables } from "@/composition/cli-container";
import { err, ok, type Result } from "@/shared/result";

const URL_WITH_PASSWORD = "postgresql://owner:s3cr3t@ep-x.neon.tech/neondb";

const printer = () => {
  const lines: string[] = [];
  return { lines, print: (line: string) => lines.push(line), text: () => lines.join("\n") };
};

const migrateWith = async (result: Result<MigrateSummary, MigrateError | MissingVariables>) => {
  const out = printer();
  const code = await runMigrate({ migrate: async () => result, print: out.print });
  return { code, text: out.text() };
};

describe("runMigrate", () => {
  it("prints each migration it applied", async () => {
    const { code, text } = await migrateWith(ok({ applied: ["001-search-schema.sql"] }));

    expect(code).toBe(0);
    expect(text).toContain("Applied 001-search-schema.sql");
  });

  it("says when there is nothing to apply", async () => {
    const { code, text } = await migrateWith(ok({ applied: [] }));

    expect(code).toBe(0);
    expect(text).toContain("No pending migrations");
  });

  it("names the failing migration, the ones applied before it, and hides credentials", async () => {
    const { code, text } = await migrateWith(
      err({
        kind: "migration-failed",
        migration: "002-b.sql",
        reason: `syntax error near ${URL_WITH_PASSWORD}`,
        applied: ["001-a.sql"],
      }),
    );

    expect(code).toBe(1);
    expect(text).toContain("Applied 001-a.sql");
    expect(text).toContain("002-b.sql failed");
    expect(text).not.toContain("s3cr3t");
  });

  it("reports a failure that is not about one migration", async () => {
    const { code, text } = await migrateWith(
      err({ kind: "migration-failed", migration: null, reason: "connection refused", applied: [] }),
    );

    expect(code).toBe(1);
    expect(text).toContain("Cannot migrate: connection refused");
  });

  it("names a missing variable", async () => {
    const { code, text } = await migrateWith(err({ kind: "missing-variables", names: ["DATABASE_URL_UNPOOLED"] }));

    expect(code).toBe(1);
    expect(text).toContain("DATABASE_URL_UNPOOLED");
  });
});
