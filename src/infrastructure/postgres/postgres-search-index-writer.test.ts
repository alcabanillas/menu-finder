import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { IndexContent, NewEmbedding } from "@/application/ports/search-index-writer";
import type { IndexedRecipe, SearchDataset } from "@/domain/search-index/search-dataset";
import { MIGRATIONS_DIR, PostgresMigrationRunner } from "@/infrastructure/postgres/postgres-migration-runner";
import { PostgresSearchIndexWriter } from "@/infrastructure/postgres/postgres-search-index-writer";
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from "@/infrastructure/postgres/test-database";

const VARIANT = "name-ingredients";

const tortilla: IndexedRecipe = {
  key: "Tortilla",
  file: "Tortilla",
  sourceMenu: 3,
  title: "Tortilla de patata",
  times: { total: 30, preparation: 10, cooking: 20, resting: null },
  ingredients: [
    { name: "huevo", householdMeasure: null, quantity: 120, unit: "g", optional: false },
    { name: "sal", householdMeasure: "al gusto", quantity: null, unit: null, optional: true },
  ],
  preparation: ["Pelar las patatas.", "Cuajar."],
};
const crema: IndexedRecipe = { ...tortilla, key: "Crema", file: "Crema", title: "Crema", ingredients: [tortilla.ingredients[0]] };
const fruta: IndexedRecipe = {
  key: "dish:Fruta",
  file: null,
  sourceMenu: null,
  title: "Fruta",
  times: null,
  ingredients: [],
  preparation: null,
};

const dataset = (recipes: IndexedRecipe[] = [crema, fruta, tortilla]): SearchDataset => ({
  menus: [
    {
      number: 1,
      meals: [
        {
          day: "monday",
          type: "lunch",
          dishes: [
            { position: 1, name: "Tortilla de patata", hasRecipeMark: true, recipeKey: "Tortilla" },
            { position: 2, name: "Fruta", hasRecipeMark: false, recipeKey: "dish:Fruta" },
          ],
        },
        { day: "monday", type: "dinner", dishes: [{ position: 1, name: "Crema", hasRecipeMark: true, recipeKey: "Crema" }] },
      ],
    },
  ],
  recipes,
});

const vector = (seed: number) => Array.from({ length: 3072 }, (_, i) => ((i + seed) % 7) / 7);
const embedding = (recipeKey: string, seed = 1): NewEmbedding => ({
  recipeKey,
  model: "gemini-embedding-2",
  source: `${recipeKey} source`,
  dimensions: 3072,
  vector: vector(seed),
});

const content = (changes: Partial<IndexContent> = {}): IndexContent => ({
  dataset: dataset(),
  embeddings: { variant: VARIANT, keep: [], add: ["Crema", "Tortilla", "dish:Fruta"].map((key) => embedding(key)) },
  ...changes,
});

describe.skipIf(!TEST_DATABASE_URL)("PostgresSearchIndexWriter (temporary Neon branch)", () => {
  let db: TestDatabase;
  let writer: PostgresSearchIndexWriter;
  beforeEach(async () => {
    db = await createTestDatabase(TEST_DATABASE_URL!);
    const runner = new PostgresMigrationRunner(db.pool, MIGRATIONS_DIR);
    await runner.applied();
    await runner.apply("001-search-schema.sql");
    writer = new PostgresSearchIndexWriter(db.pool);
  });
  afterEach(async () => {
    await db.drop();
  });

  const rows = async (sql: string) => (await db.pool.query(sql)).rows;
  const snapshot = async () => ({
    menus: await rows("SELECT * FROM menu ORDER BY number"),
    meals: await rows("SELECT * FROM meal ORDER BY menu_number, day, type"),
    dishes: await rows("SELECT * FROM menu_dish ORDER BY menu_number, day, type, position"),
    recipes: await rows("SELECT * FROM recipe ORDER BY key"),
    ingredients: await rows("SELECT * FROM recipe_ingredient ORDER BY recipe_key, position"),
    embeddings: await rows("SELECT recipe_key, variant, model, dimensions, source, embedding::text FROM recipe_embedding ORDER BY recipe_key"),
  });

  it("stores the menus, dishes in position, recipes with their text, and one embedding per row", async () => {
    expect(await writer.replace(content())).toEqual({ ok: true, value: undefined });

    const stored = await snapshot();
    expect(stored.menus).toEqual([{ number: 1 }]);
    expect(stored.meals).toHaveLength(2);
    expect(stored.dishes.map((d) => [d.type, d.position, d.name, d.recipe_key])).toEqual([
      ["dinner", 1, "Crema", "Crema"],
      ["lunch", 1, "Tortilla de patata", "Tortilla"],
      ["lunch", 2, "Fruta", "dish:Fruta"],
    ]);
    expect(stored.recipes.find((r) => r.key === "Tortilla")).toMatchObject({
      file: "Tortilla",
      source_menu: 3,
      title: "Tortilla de patata",
      total_min: 30,
      resting_min: null,
      preparation: ["Pelar las patatas.", "Cuajar."],
    });
    expect(stored.recipes.find((r) => r.key === "dish:Fruta")).toMatchObject({ file: null, total_min: null, preparation: null });
    expect(stored.ingredients.filter((i) => i.recipe_key === "Tortilla").map((i) => [i.position, i.name, i.optional])).toEqual([
      [1, "huevo", false],
      [2, "sal", true],
    ]);
    expect(stored.embeddings.map((e) => [e.recipe_key, e.dimensions])).toEqual([
      ["Crema", 3072],
      ["Tortilla", 3072],
      ["dish:Fruta", 3072],
    ]);
  });

  it("returns what each stored embedding was computed from", async () => {
    await writer.replace(content());

    const sources = await writer.embeddingSources(VARIANT);

    expect(sources.ok && [...sources.value].sort((a, b) => (a.recipeKey < b.recipeKey ? -1 : 1))).toEqual([
      { recipeKey: "Crema", model: "gemini-embedding-2", source: "Crema source" },
      { recipeKey: "Tortilla", model: "gemini-embedding-2", source: "Tortilla source" },
      { recipeKey: "dish:Fruta", model: "gemini-embedding-2", source: "dish:Fruta source" },
    ]);
  });

  it("leaves identical rows when the same content is written twice, keeping the embeddings", async () => {
    await writer.replace(content());
    const first = await snapshot();

    await writer.replace(content({ embeddings: { variant: VARIANT, keep: ["Crema", "Tortilla", "dish:Fruta"], add: [] } }));

    expect(await snapshot()).toEqual(first);
  });

  it("removes a recipe that is gone, with its ingredients and embedding", async () => {
    await writer.replace(content());
    const withoutCrema: SearchDataset = { menus: [], recipes: [fruta, tortilla] };

    await writer.replace({ dataset: withoutCrema, embeddings: { variant: VARIANT, keep: ["Tortilla", "dish:Fruta"], add: [] } });

    const stored = await snapshot();
    expect(stored.recipes.map((r) => r.key)).toEqual(["Tortilla", "dish:Fruta"]);
    expect(stored.ingredients.some((i) => i.recipe_key === "Crema")).toBe(false);
    expect(stored.embeddings.map((e) => e.recipe_key)).toEqual(["Tortilla", "dish:Fruta"]);
    expect(stored.menus).toEqual([]);
  });

  it("replaces an embedding that is not kept and keeps the others as they were", async () => {
    await writer.replace(content());
    const before = await snapshot();

    await writer.replace(
      content({ embeddings: { variant: VARIANT, keep: ["Crema", "dish:Fruta"], add: [embedding("Tortilla", 5)] } }),
    );

    const after = await snapshot();
    expect(after.embeddings.find((e) => e.recipe_key === "Crema")).toEqual(before.embeddings.find((e) => e.recipe_key === "Crema"));
    expect(after.embeddings.find((e) => e.recipe_key === "Tortilla")).not.toEqual(
      before.embeddings.find((e) => e.recipe_key === "Tortilla"),
    );
  });

  it("changes nothing when the write fails half-way", async () => {
    await writer.replace(content());
    const before = await snapshot();
    const broken = dataset([crema, fruta]); // the tortilla dish now points to a recipe that is not written

    const result = await writer.replace(content({ dataset: broken }));

    expect(result.ok).toBe(false);
    expect(await snapshot()).toEqual(before);
  });

  it("stores names with quotes and SQL fragments as plain text", async () => {
    const hostile: IndexedRecipe = { ...fruta, key: "dish:x'); DROP TABLE menu; --", title: "x'); DROP TABLE menu; --" };

    await writer.replace({ dataset: { menus: [], recipes: [hostile] }, embeddings: { variant: VARIANT, keep: [], add: [] } });

    expect((await snapshot()).recipes.map((r) => r.title)).toEqual(["x'); DROP TABLE menu; --"]);
  });

  it("explains a missing schema", async () => {
    await db.pool.query("DROP TABLE recipe_embedding");

    const result = await writer.embeddingSources(VARIANT);

    expect(!result.ok && result.error.reason).toContain("pnpm ingest migrate");
  });
});
