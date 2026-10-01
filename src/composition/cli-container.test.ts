import { describe, expect, it } from "vitest";
import { createCliContainer } from "./cli-container";

// A host that does not exist: if the container tried to connect, the error would be a network error.
const UNREACHABLE = "postgresql://user:password@unreachable.invalid/db";

describe("createCliContainer", () => {
  it("names a missing key for load and does not connect", async () => {
    const container = createCliContainer({ DATABASE_URL_UNPOOLED: UNREACHABLE });

    expect(await container.loadSearchIndex()).toEqual({
      ok: false,
      error: { kind: "missing-variables", names: ["GEMINI_API_KEY"] },
    });
  });

  it("names every missing variable for load", async () => {
    expect(await createCliContainer({}).loadSearchIndex()).toEqual({
      ok: false,
      error: { kind: "missing-variables", names: ["DATABASE_URL_UNPOOLED", "GEMINI_API_KEY"] },
    });
  });

  it("names a missing connection string for migrate", async () => {
    expect(await createCliContainer({ GEMINI_API_KEY: "key" }).migrate()).toEqual({
      ok: false,
      error: { kind: "missing-variables", names: ["DATABASE_URL_UNPOOLED"] },
    });
  });

  it("treats an empty variable as missing", async () => {
    expect(await createCliContainer({ DATABASE_URL_UNPOOLED: "" }).migrate()).toEqual({
      ok: false,
      error: { kind: "missing-variables", names: ["DATABASE_URL_UNPOOLED"] },
    });
  });
});
