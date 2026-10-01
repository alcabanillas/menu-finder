import { describe, expect, it } from "vitest";
import { EMBEDDING_MODEL, GenkitEmbeddings, type EmbedMany } from "@/infrastructure/genkit/genkit-embeddings";

const KEY = "AIzaFAKE-key-for-tests";

const recording = (dimensions = 3072) => {
  const batches: string[][] = [];
  const embedMany: EmbedMany = async (texts) => {
    batches.push(texts);
    return texts.map((_, i) => Array.from({ length: dimensions }, () => i));
  };
  return { embedMany, batches };
};

describe("GenkitEmbeddings", () => {
  it("uses gemini-embedding-2 and returns the model and the dimensions", async () => {
    const { embedMany } = recording();
    const port = new GenkitEmbeddings(embedMany, KEY);

    const result = await port.embedDocuments([{ title: "Tortilla", content: "huevo, patata" }]);

    expect(port.model).toBe("gemini-embedding-2");
    expect(EMBEDDING_MODEL).toBe("gemini-embedding-2");
    expect(result.ok && [result.value.model, result.value.dimensions, result.value.vectors.length]).toEqual([
      "gemini-embedding-2",
      3072,
      1,
    ]);
  });

  it("writes the document task prefix itself, because the model has no task_type for text", async () => {
    const { embedMany, batches } = recording();

    await new GenkitEmbeddings(embedMany, KEY).embedDocuments([
      { title: "Tortilla", content: "huevo, patata" },
      { title: "", content: "Fruta" },
    ]);

    expect(batches).toEqual([["title: Tortilla | text: huevo, patata", "title: none | text: Fruta"]]);
  });

  it("sends the documents in batches and keeps their order", async () => {
    const { embedMany, batches } = recording(2);
    const documents = Array.from({ length: 5 }, (_, i) => ({ title: `T${i}`, content: "x" }));

    const result = await new GenkitEmbeddings(embedMany, KEY, 2).embedDocuments(documents);

    expect(batches.map((batch) => batch.length)).toEqual([2, 2, 1]);
    expect(result.ok && result.value.vectors.map((v) => v[0])).toEqual([0, 1, 0, 1, 0]);
  });

  it("returns no vectors and makes no call for no documents", async () => {
    const { embedMany, batches } = recording();

    const result = await new GenkitEmbeddings(embedMany, KEY).embedDocuments([]);

    expect(result).toEqual({ ok: true, value: { model: EMBEDDING_MODEL, dimensions: 0, vectors: [] } });
    expect(batches).toEqual([]);
  });

  it("fails when the vectors do not all have the same size", async () => {
    let call = 0;
    const uneven: EmbedMany = async (texts) => texts.map(() => (call++ === 0 ? [1, 2, 3] : [1, 2]));

    const result = await new GenkitEmbeddings(uneven, KEY).embedDocuments([
      { title: "a", content: "a" },
      { title: "b", content: "b" },
    ]);

    expect(result).toEqual({ ok: false, error: { kind: "embedding-failed", reason: "vectors of different sizes: 3 and 2" } });
  });

  it("reports a service error without the key", async () => {
    const failing: EmbedMany = async () => {
      throw new Error(`[400 Bad Request] API key not valid: ${KEY}`);
    };

    const result = await new GenkitEmbeddings(failing, KEY).embedDocuments([{ title: "a", content: "a" }]);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.reason).toContain("API key not valid");
    expect(JSON.stringify(result)).not.toContain(KEY);
  });
});
