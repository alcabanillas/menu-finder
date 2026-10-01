import { describe, expect, it } from "vitest";
import type { RepositoryError } from "@/application/ports/menu-repository";
import { FanOutRepository } from "@/infrastructure/fan-out/fan-out-repository";
import { err, ok, type Result } from "@/shared/result";

/** A repository that records its saves, or fails with the given reason. */
const fake = (name: string, log: string[], failure?: string) => ({
  saveAll: async (items: number[]): Promise<Result<void, RepositoryError>> => {
    if (failure) return err({ kind: "write-failed", reason: failure });
    log.push(`${name}:${items.join(",")}`);
    return ok(undefined);
  },
});

describe("FanOutRepository", () => {
  it("saves to the file and then to the database", async () => {
    const log: string[] = [];
    const repository = new FanOutRepository(fake("file", log), fake("database", log), "data/menu-platos.json");

    expect(await repository.saveAll([1, 2])).toEqual(ok(undefined));
    expect(log).toEqual(["file:1,2", "database:1,2"]);
  });

  it("does not touch the database when the file cannot be written", async () => {
    const log: string[] = [];
    const repository = new FanOutRepository(fake("file", log, "EACCES"), fake("database", log), "data/menu-platos.json");

    expect(await repository.saveAll([1])).toEqual(err({ kind: "write-failed", reason: "EACCES" }));
    expect(log).toEqual([]);
  });

  it("says that the file was written and why the database save failed", async () => {
    const log: string[] = [];
    const repository = new FanOutRepository(
      fake("file", log),
      fake("database", log, "connection refused"),
      "data/menu-platos.json",
    );

    expect(await repository.saveAll([1])).toEqual(
      err({
        kind: "write-failed",
        reason: "data/menu-platos.json was written, but the database save failed: connection refused",
      }),
    );
    expect(log).toEqual(["file:1"]);
  });
});
