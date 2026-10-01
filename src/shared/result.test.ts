import { describe, expect, it } from "vitest";
import { err, ok, type Result } from "@/shared/result";

describe("Result", () => {
  it("ok wraps a value and is narrowed by the ok flag", () => {
    const result: Result<number, string> = ok(42);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(42);
  });

  it("err wraps an error and is narrowed by the ok flag", () => {
    const result: Result<number, string> = err("boom");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("boom");
  });
});
