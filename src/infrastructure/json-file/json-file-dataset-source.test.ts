import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JsonFileDatasetSource } from "@/infrastructure/json-file/json-file-dataset-source";

const dataDir = async (files: Record<string, string>) => {
  const dir = await mkdtemp(join(tmpdir(), "dataset-"));
  for (const [name, content] of Object.entries(files)) await writeFile(join(dir, name), content, "utf8");
  return dir;
};

// The shape of the content is checked by the use case (loadSearchIndex): the source only reads JSON.
describe("JsonFileDatasetSource", () => {
  it("reads both files as parsed JSON, with their names", async () => {
    const source = new JsonFileDatasetSource(await dataDir({ "menu-platos.json": "[1]", "recetas.json": '[{"a":2}]' }));

    expect(await source.readMenus()).toEqual({ ok: true, value: { file: "menu-platos.json", content: [1] } });
    expect(await source.readRecipes()).toEqual({ ok: true, value: { file: "recetas.json", content: [{ a: 2 }] } });
  });

  it("names a missing file and the command that generates it", async () => {
    const source = new JsonFileDatasetSource(await dataDir({}));

    expect(await source.readMenus()).toEqual({
      ok: false,
      error: { kind: "missing-file", file: "menu-platos.json", command: "pnpm ingest menu" },
    });
    expect(await source.readRecipes()).toEqual({
      ok: false,
      error: { kind: "missing-file", file: "recetas.json", command: "pnpm ingest recipes" },
    });
  });

  it("names a file that is not JSON", async () => {
    const source = new JsonFileDatasetSource(await dataDir({ "recetas.json": "{ not json" }));

    const result = await source.readRecipes();

    expect(result).toEqual({ ok: false, error: { kind: "invalid-json", file: "recetas.json", reason: expect.any(String) } });
  });
});
