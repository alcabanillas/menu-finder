import { describe, expect, it } from "vitest";
import type { WeeklyMenu } from "@/domain/menu/weekly-menu";
import type { Recipe } from "@/domain/recipe/recipe";
import { err, ok, type Result } from "@/shared/result";
import type { DatasetFile, DatasetSource, DatasetSourceError } from "../ports/dataset-source";
import type { EmbeddingDocument, EmbeddingsPort } from "../ports/embeddings-port";
import type { EmbeddingSource, IndexContent, SearchIndexWriter } from "../ports/search-index-writer";
import { EMBEDDING_VARIANT, loadSearchIndex } from "./load-search-index";

const MODEL = "fake-embedding";

const tortilla: Recipe = {
  file: "Tortilla-de-patata",
  sourceMenu: 2,
  title: "Tortilla de patata",
  times: { total: 30, preparation: 10, cooking: 20, resting: null },
  ingredients: [
    { name: "huevo", householdMeasure: null, quantity: 120, unit: "g", optional: false },
    { name: "patata", householdMeasure: "1 unidad", quantity: 200, unit: "g", optional: false },
  ],
  preparation: ["Pelar y freír las patatas.", "Cuajar con el huevo."],
};

const crema: Recipe = { ...tortilla, file: "Crema", title: "Crema de calabaza", ingredients: [tortilla.ingredients[0]] };

const menus: WeeklyMenu[] = [
  {
    number: 1,
    meals: [
      {
        day: "monday",
        type: "lunch",
        dishes: [
          { position: 1, name: "Tortilla de patata", hasRecipeMark: true, recipeFile: "Tortilla-de-patata" },
          { position: 2, name: "Fruta", hasRecipeMark: false, recipeFile: null },
        ],
      },
      { day: "monday", type: "dinner", dishes: [{ position: 1, name: "Crema", hasRecipeMark: true, recipeFile: "Crema" }] },
    ],
  },
];

type Files = { menus?: Result<DatasetFile, DatasetSourceError>; recipes?: Result<DatasetFile, DatasetSourceError> };

const fakeDataset = (content: { menus?: unknown; recipes?: unknown } = {}, files: Files = {}): DatasetSource => ({
  readMenus: async () => files.menus ?? ok({ file: "menu-platos.json", content: content.menus ?? menus }),
  readRecipes: async () => files.recipes ?? ok({ file: "recetas.json", content: content.recipes ?? [tortilla, crema] }),
});

const fakeEmbeddings = (fail = false) => {
  const calls: EmbeddingDocument[][] = [];
  const port: EmbeddingsPort = {
    model: MODEL,
    embedDocuments: async (documents) => {
      calls.push(documents);
      if (fail) return err({ kind: "embedding-failed", reason: "quota exceeded" });
      return ok({ model: MODEL, dimensions: 2, vectors: documents.map((_, i) => [i, 1]) });
    },
  };
  return { port, calls };
};

/** Keeps the last written content, as the database would, and its embedding sources. */
const fakeIndex = (options: { failReplace?: boolean; failRead?: boolean } = {}) => {
  const writes: IndexContent[] = [];
  let sources: EmbeddingSource[] = [];
  const writer: SearchIndexWriter = {
    embeddingSources: async () =>
      options.failRead ? err({ kind: "index-failed", reason: "connection refused" }) : ok(sources),
    replace: async (content) => {
      if (options.failReplace) return err({ kind: "index-failed", reason: "deadlock" });
      writes.push(content);
      const kept = sources.filter((s) => content.embeddings.keep.includes(s.recipeKey));
      const added = content.embeddings.add.map(({ recipeKey, model, source }) => ({ recipeKey, model, source }));
      sources = [...kept, ...added];
      return ok(undefined);
    },
  };
  return { writer, writes, sources: () => sources };
};

const load = (deps: Partial<Parameters<typeof loadSearchIndex>[0]> = {}) =>
  loadSearchIndex({
    dataset: deps.dataset ?? fakeDataset(),
    embeddings: deps.embeddings ?? fakeEmbeddings().port,
    index: deps.index ?? fakeIndex().writer,
  });

describe("loadSearchIndex", () => {
  it("writes the whole dataset with one embedding per recipe row", async () => {
    const index = fakeIndex();

    const result = await load({ index: index.writer });

    expect(result).toEqual(
      ok({ menus: 1, meals: 2, dishes: 3, recipes: 2, nameOnlyRecipes: 1, embedded: 3, kept: 0, model: MODEL }),
    );
    const [write] = index.writes;
    expect(write.dataset.recipes.map((r) => r.key)).toEqual(["Crema", "Tortilla-de-patata", "dish:Fruta"]);
    expect(write.embeddings.variant).toBe(EMBEDDING_VARIANT);
    expect(write.embeddings.add.map((e) => [e.recipeKey, e.model, e.dimensions])).toEqual([
      ["Crema", MODEL, 2],
      ["Tortilla-de-patata", MODEL, 2],
      ["dish:Fruta", MODEL, 2],
    ]);
  });

  it("sends the title and the ingredients to the embedding service, and no preparation", async () => {
    const embeddings = fakeEmbeddings();

    await load({ embeddings: embeddings.port });

    const sent = embeddings.calls.flat();
    expect(sent).toContainEqual({ title: "Tortilla de patata", content: "huevo, patata" });
    expect(JSON.stringify(sent)).not.toContain("Pelar");
    expect(JSON.stringify(sent)).not.toContain("Cuajar");
  });

  it("makes no embedding call on an unchanged second run, and keeps every embedding", async () => {
    const index = fakeIndex();
    const embeddings = fakeEmbeddings();
    await load({ index: index.writer, embeddings: embeddings.port });

    const second = await load({ index: index.writer, embeddings: embeddings.port });

    expect(embeddings.calls).toHaveLength(1);
    expect(second.ok && second.value).toMatchObject({ embedded: 0, kept: 3 });
    expect(index.writes[1].embeddings).toMatchObject({ keep: ["Crema", "Tortilla-de-patata", "dish:Fruta"], add: [] });
  });

  it("recomputes only the embedding of the recipe whose ingredients changed", async () => {
    const index = fakeIndex();
    const embeddings = fakeEmbeddings();
    await load({ index: index.writer, embeddings: embeddings.port });
    const changed = { ...tortilla, ingredients: [...tortilla.ingredients, { ...tortilla.ingredients[0], name: "cebolla" }] };

    await load({ dataset: fakeDataset({ recipes: [changed, crema] }), index: index.writer, embeddings: embeddings.port });

    expect(embeddings.calls[1]).toEqual([{ title: "Tortilla de patata", content: "huevo, patata, cebolla" }]);
    expect(index.writes[1].embeddings.keep).toEqual(["Crema", "dish:Fruta"]);
  });

  it("recomputes every embedding when the model changes", async () => {
    const index = fakeIndex();
    await load({ index: index.writer });
    const other = fakeEmbeddings();
    const renamed: EmbeddingsPort = { ...other.port, model: "other-model" };

    const result = await load({ index: index.writer, embeddings: renamed });

    expect(other.calls[0]).toHaveLength(3);
    expect(result.ok && result.value).toMatchObject({ embedded: 3, kept: 0 });
  });

  it("does not keep the embedding of a recipe that is gone from the files", async () => {
    const index = fakeIndex();
    await load({ index: index.writer });

    await load({ dataset: fakeDataset({ menus: [], recipes: [crema] }), index: index.writer });

    expect(index.writes[1].embeddings.keep).toEqual(["Crema"]);
    expect(index.writes[1].dataset.recipes.map((r) => r.key)).toEqual(["Crema"]);
  });

  describe("leaves the index untouched", () => {
    const untouched = async (dataset: DatasetSource) => {
      const index = fakeIndex();
      const embeddings = fakeEmbeddings();
      const result = await load({ dataset, index: index.writer, embeddings: embeddings.port });
      expect(index.writes).toEqual([]);
      expect(embeddings.calls).toEqual([]);
      return result;
    };

    it("when a file is missing", async () => {
      const missing: DatasetSourceError = { kind: "missing-file", file: "recetas.json", command: "pnpm ingest recipes" };

      const result = await untouched(fakeDataset({}, { recipes: err(missing) }));

      expect(result).toEqual(err({ kind: "source", error: missing }));
    });

    it("when a file is not JSON", async () => {
      const notJson: DatasetSourceError = { kind: "invalid-json", file: "menu-platos.json", reason: "Unexpected token" };

      expect(await untouched(fakeDataset({}, { menus: err(notJson) }))).toEqual(err({ kind: "source", error: notJson }));
    });

    it("when a recipe has no ingredients array, naming the file and the first invalid path", async () => {
      const broken: Partial<Recipe> = { ...crema };
      delete broken.ingredients;

      const result = await untouched(fakeDataset({ recipes: [tortilla, broken] }));

      expect(result).toEqual(
        err({ kind: "invalid-shape", file: "recetas.json", path: "[1].ingredients", message: expect.any(String) }),
      );
    });

    it("when the menus are not a list of weekly menus", async () => {
      const result = await untouched(fakeDataset({ menus: { number: 1 } }));

      expect(result).toEqual(err({ kind: "invalid-shape", file: "menu-platos.json", path: "(root)", message: expect.any(String) }));
    });

    it("when a dish names an unknown recipe file, naming the menu and the dish", async () => {
      const result = await untouched(fakeDataset({ recipes: [tortilla] }));

      expect(result).toEqual(err({ kind: "unknown-recipe-files", dishes: [{ menu: 1, dish: "Crema", file: "Crema" }] }));
    });
  });

  it("keeps the previous content when the embedding service fails", async () => {
    const index = fakeIndex();

    const result = await load({ index: index.writer, embeddings: fakeEmbeddings(true).port });

    expect(result).toEqual(err({ kind: "embedding-failed", reason: "quota exceeded" }));
    expect(index.writes).toEqual([]);
  });

  it("fails when the service returns a different number of vectors than texts", async () => {
    const short: EmbeddingsPort = {
      model: MODEL,
      embedDocuments: async () => ok({ model: MODEL, dimensions: 2, vectors: [[1, 0]] }),
    };
    const index = fakeIndex();

    const result = await load({ embeddings: short, index: index.writer });

    expect(result).toEqual(err({ kind: "embedding-failed", reason: "the service returned 1 vectors for 3 texts" }));
    expect(index.writes).toEqual([]);
  });

  it("reports an index that cannot be read", async () => {
    expect(await load({ index: fakeIndex({ failRead: true }).writer })).toEqual(
      err({ kind: "index-failed", reason: "connection refused" }),
    );
  });

  it("reports an index that cannot be written", async () => {
    expect(await load({ index: fakeIndex({ failReplace: true }).writer })).toEqual(
      err({ kind: "index-failed", reason: "deadlock" }),
    );
  });
});
