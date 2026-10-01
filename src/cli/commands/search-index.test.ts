import { describe, expect, it } from "vitest";
import type { LoadSearchIndexError, LoadSearchIndexSummary } from "@/application/dto/load-search-index";
import type { MigrateError, MigrateSummary } from "@/application/use-cases/migrate";
import { err, ok, type Result } from "@/shared/result";
import { runLoad, runMigrate, type MissingVariables } from "./search-index";

const URL_WITH_PASSWORD = "postgresql://owner:s3cr3t@ep-x.neon.tech/neondb";

const printer = () => {
  const lines: string[] = [];
  return { lines, print: (line: string) => lines.push(line), text: () => lines.join("\n") };
};

const summary: LoadSearchIndexSummary = {
  menus: 36,
  meals: 504,
  dishes: 608,
  recipes: 434,
  nameOnlyRecipes: 14,
  embedded: 448,
  kept: 0,
  model: "gemini-embedding-2",
};

const load = async (result: Result<LoadSearchIndexSummary, LoadSearchIndexError | MissingVariables>) => {
  const out = printer();
  const code = await runLoad({ loadSearchIndex: async () => result, print: out.print });
  return { code, text: out.text() };
};

const migrateWith = async (result: Result<MigrateSummary, MigrateError | MissingVariables>) => {
  const out = printer();
  const code = await runMigrate({ migrate: async () => result, print: out.print });
  return { code, text: out.text() };
};

describe("runLoad", () => {
  it("prints what was loaded and the embeddings computed and kept", async () => {
    const { code, text } = await load(ok(summary));

    expect(code).toBe(0);
    expect(text).toContain("36 menus, 504 meals, 608 dishes, 434 recipes and 14 name-only rows");
    expect(text).toContain("gemini-embedding-2: 448 computed, 0 kept");
  });

  it("names a missing variable and exits with 1", async () => {
    const { code, text } = await load(err({ kind: "missing-variables", names: ["GEMINI_API_KEY"] }));

    expect(code).toBe(1);
    expect(text).toContain("GEMINI_API_KEY");
  });

  it("names a missing file and the command that generates it", async () => {
    const { code, text } = await load(
      err({ kind: "source", error: { kind: "missing-file", file: "recetas.json", command: "pnpm ingest recipes" } }),
    );

    expect(code).toBe(1);
    expect(text).toContain("recetas.json");
    expect(text).toContain("pnpm ingest recipes");
  });

  it("names a file that is not JSON", async () => {
    const { code, text } = await load(
      err({ kind: "source", error: { kind: "invalid-json", file: "menu-platos.json", reason: "Unexpected token" } }),
    );

    expect(code).toBe(1);
    expect(text).toContain("menu-platos.json is not JSON");
  });

  it("names the file and the first invalid path of a malformed file", async () => {
    const { code, text } = await load(
      err({ kind: "invalid-shape", file: "recetas.json", path: "[1].ingredients", message: "Invalid input" }),
    );

    expect(code).toBe(1);
    expect(text).toContain("recetas.json");
    expect(text).toContain("[1].ingredients");
  });

  it("names the menu and the dish of every unknown recipe file", async () => {
    const { code, text } = await load(
      err({ kind: "unknown-recipe-files", dishes: [{ menu: 4, dish: "Guiso", file: "Guiso-perdido" }] }),
    );

    expect(code).toBe(1);
    expect(text).toContain('Menu 4, dish "Guiso": unknown recipe file Guiso-perdido');
  });

  it("reports an embedding failure and says the database was not changed", async () => {
    const { code, text } = await load(err({ kind: "embedding-failed", reason: "quota exceeded" }));

    expect(code).toBe(1);
    expect(text).toContain("quota exceeded");
    expect(text).toContain("unchanged");
  });

  it("prints a database error without the credentials of the connection string", async () => {
    const { code, text } = await load(err({ kind: "index-failed", reason: `connect failed: ${URL_WITH_PASSWORD}` }));

    expect(code).toBe(1);
    expect(text).toContain("connect failed");
    expect(text).not.toContain("s3cr3t");
  });
});

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
