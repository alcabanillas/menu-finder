import { z } from "zod";
import type { UnknownRecipeFile } from "@/domain/search-index/search-dataset";
import type { DatasetSourceError } from "../ports/dataset-source";

// Shapes of the files written by `pnpm ingest menu` (`WeeklyMenu[]`) and `pnpm ingest recipes` (`Recipe[]`).
const minutes = z.number().int().nonnegative().nullable();

export const weeklyMenusSchema = z.array(
  z.strictObject({
    number: z.number().int().positive(),
    meals: z.array(
      z.strictObject({
        day: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),
        type: z.enum(["lunch", "dinner"]),
        dishes: z.array(
          z.strictObject({
            position: z.number().int().positive(),
            name: z.string().min(1),
            hasRecipeMark: z.boolean(),
            recipeFile: z.string().min(1).nullable(),
          }),
        ),
      }),
    ),
  }),
);

export const recipesSchema = z.array(
  z.strictObject({
    file: z.string().min(1),
    sourceMenu: z.number().int().positive(),
    title: z.string().min(1),
    times: z.strictObject({ total: minutes, preparation: minutes, cooking: minutes, resting: minutes }),
    ingredients: z.array(
      z.strictObject({
        name: z.string().min(1),
        householdMeasure: z.string().nullable(),
        quantity: z.number().nullable(),
        unit: z.enum(["g", "ml", "kg", "l"]).nullable(),
        optional: z.boolean(),
      }),
    ),
    preparation: z.array(z.string()),
  }),
);

export type LoadSearchIndexSummary = {
  menus: number;
  meals: number;
  dishes: number;
  /** Recipe files. */
  recipes: number;
  /** Rows for dishes without recipe file, one per distinct name. */
  nameOnlyRecipes: number;
  /** Embeddings computed in this run. */
  embedded: number;
  /** Embeddings kept because their text and model did not change. */
  kept: number;
  model: string;
};

export type LoadSearchIndexError =
  | { kind: "source"; error: DatasetSourceError }
  /** `path` is the first invalid path, `(root)` for the file itself. */
  | { kind: "invalid-shape"; file: string; path: string; message: string }
  | { kind: "unknown-recipe-files"; dishes: UnknownRecipeFile[] }
  | { kind: "embedding-failed"; reason: string }
  | { kind: "index-failed"; reason: string };
