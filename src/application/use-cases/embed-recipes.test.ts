import { describe, expect, it } from "vitest";
import type { EmbeddingDocument, EmbeddingsPort } from "@/application/ports/embeddings-port";
import type {
  NewEmbedding,
  RecipeEmbeddingRepository,
  RecipeToEmbed,
} from "@/application/ports/recipe-embedding-repository";
import { EMBEDDING_VARIANT, embedRecipes } from "@/application/use-cases/embed-recipes";
import { err, ok } from "@/shared/result";

const MODEL = "gemini-embedding-2";

const tortilla: RecipeToEmbed = {
  recipeKey: "Tortilla",
  title: "Tortilla de patata",
  ingredientNames: ["huevo", "patata"],
  stored: null,
};
const fruta: RecipeToEmbed = { recipeKey: "dish:Fruta", title: "Fruta", ingredientNames: [], stored: null };

const storedFrom = (recipe: RecipeToEmbed, model = MODEL) => ({
  ...recipe,
  stored: { model, source: `${recipe.title}\n${recipe.ingredientNames.join(", ") || recipe.title}` },
});

/** A store with the given rows that records what is saved. */
const fakeStore = (rows: RecipeToEmbed[], saveFails = false) => {
  const saved: { variant: string; embeddings: NewEmbedding[] }[] = [];
  const store: RecipeEmbeddingRepository = {
    documents: async () => ok(rows),
    saveAll: async (variant, embeddings) => {
      if (saveFails) return err({ kind: "store-failed", reason: "connection lost" });
      saved.push({ variant, embeddings });
      return ok(undefined);
    },
  };
  return { store, saved };
};

/** An embedding service that records the documents it receives. */
const fakeEmbeddings = (fails = false) => {
  const calls: EmbeddingDocument[][] = [];
  const embeddings: EmbeddingsPort = {
    model: MODEL,
    embedDocuments: async (documents) => {
      calls.push(documents);
      if (fails) return err({ kind: "embedding-failed", reason: "503 Service Unavailable" });
      return ok({ model: MODEL, dimensions: 3, vectors: documents.map((_, i) => [i, 0, 1]) });
    },
  };
  return { embeddings, calls };
};

describe("embedRecipes", () => {
  it("embeds every recipe row, the rows of dishes without recipe included", async () => {
    const { store, saved } = fakeStore([tortilla, fruta]);
    const { embeddings, calls } = fakeEmbeddings();

    const result = await embedRecipes({ store, embeddings });

    expect(calls).toEqual([
      [
        { title: "Tortilla de patata", content: "huevo, patata" },
        { title: "Fruta", content: "Fruta" },
      ],
    ]);
    expect(saved).toHaveLength(1);
    expect(saved[0].variant).toBe(EMBEDDING_VARIANT);
    expect(saved[0].embeddings.map(({ recipeKey, model, dimensions }) => ({ recipeKey, model, dimensions }))).toEqual([
      { recipeKey: "Tortilla", model: MODEL, dimensions: 3 },
      { recipeKey: "dish:Fruta", model: MODEL, dimensions: 3 },
    ]);
    expect(result).toEqual(ok({ recipes: 2, embedded: 2, kept: 0, model: MODEL }));
  });

  it("stores the text each vector came from", async () => {
    const { store, saved } = fakeStore([tortilla]);

    await embedRecipes({ store, embeddings: fakeEmbeddings().embeddings });

    expect(saved[0].embeddings[0].source).toBe("Tortilla de patata\nhuevo, patata");
  });

  it("calls nothing and saves nothing when every text and the model are unchanged", async () => {
    const { store, saved } = fakeStore([storedFrom(tortilla), storedFrom(fruta)]);
    const { embeddings, calls } = fakeEmbeddings();

    const result = await embedRecipes({ store, embeddings });

    expect(calls).toEqual([]);
    expect(saved).toEqual([]);
    expect(result).toEqual(ok({ recipes: 2, embedded: 0, kept: 2, model: MODEL }));
  });

  it("only sends the recipe whose ingredients changed", async () => {
    const changed = { ...storedFrom(tortilla), ingredientNames: ["huevo", "patata", "cebolla"] };
    const { store } = fakeStore([changed, storedFrom(fruta)]);
    const { embeddings, calls } = fakeEmbeddings();

    const result = await embedRecipes({ store, embeddings });

    expect(calls).toEqual([[{ title: "Tortilla de patata", content: "huevo, patata, cebolla" }]]);
    expect(result).toEqual(ok({ recipes: 2, embedded: 1, kept: 1, model: MODEL }));
  });

  it("sends every recipe again when the model changed", async () => {
    const { store } = fakeStore([storedFrom(tortilla, "gemini-embedding-001"), storedFrom(fruta, "gemini-embedding-001")]);
    const { embeddings, calls } = fakeEmbeddings();

    await embedRecipes({ store, embeddings });

    expect(calls[0]).toHaveLength(2);
  });

  it("saves nothing when the embedding service fails", async () => {
    const { store, saved } = fakeStore([tortilla]);

    const result = await embedRecipes({ store, embeddings: fakeEmbeddings(true).embeddings });

    expect(result).toEqual(err({ kind: "embedding-failed", reason: "503 Service Unavailable" }));
    expect(saved).toEqual([]);
  });

  it("saves nothing when the service returns fewer vectors than texts", async () => {
    const { store, saved } = fakeStore([tortilla, fruta]);
    const short: EmbeddingsPort = {
      model: MODEL,
      embedDocuments: async () => ok({ model: MODEL, dimensions: 3, vectors: [[1, 2, 3]] }),
    };

    const result = await embedRecipes({ store, embeddings: short });

    expect(result).toEqual(err({ kind: "embedding-failed", reason: "the service returned 1 vectors for 2 texts" }));
    expect(saved).toEqual([]);
  });

  it("returns the error of the store when the rows cannot be read", async () => {
    const store: RecipeEmbeddingRepository = {
      documents: async () => err({ kind: "store-failed", reason: "connection refused" }),
      saveAll: async () => ok(undefined),
    };
    const { embeddings, calls } = fakeEmbeddings();

    expect(await embedRecipes({ store, embeddings })).toEqual(err({ kind: "store-failed", reason: "connection refused" }));
    expect(calls).toEqual([]);
  });

  it("returns the error of the store when the vectors cannot be saved", async () => {
    const { store } = fakeStore([tortilla], true);

    expect(await embedRecipes({ store, embeddings: fakeEmbeddings().embeddings })).toEqual(
      err({ kind: "store-failed", reason: "connection lost" }),
    );
  });
});
