import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultQuickNotesSnapshot } from "../domain";
import {
  LocalStorageQuickNotesRepository,
  quickNotesStorageKey,
  type QuickNotesStorage,
} from "./LocalStorageQuickNotesRepository";

class MemoryStorage implements QuickNotesStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("LocalStorageQuickNotesRepository", () => {
  let storage: MemoryStorage;
  let repository: LocalStorageQuickNotesRepository;

  beforeEach(() => {
    storage = new MemoryStorage();
    repository = new LocalStorageQuickNotesRepository(() => storage);
  });

  it("isolates encoded user, branch, and null-branch keys", async () => {
    const globalScope = { userId: "user:1", sucursalId: null };
    const namedGlobalScope = { userId: "user:1", sucursalId: "none" };
    const otherUser = { userId: "user", sucursalId: "1:none" };

    await repository.save(
      globalScope,
      createDefaultQuickNotesSnapshot(globalScope),
    );
    await repository.save(
      namedGlobalScope,
      createDefaultQuickNotesSnapshot(namedGlobalScope),
    );
    await repository.save(
      otherUser,
      createDefaultQuickNotesSnapshot(otherUser),
    );

    const keys = [
      quickNotesStorageKey(globalScope),
      quickNotesStorageKey(namedGlobalScope),
      quickNotesStorageKey(otherUser),
    ];
    expect(new Set(keys).size).toBe(3);
    await expect(
      repository.load({ userId: "missing", sucursalId: null }),
    ).resolves.toEqual({ status: "missing" });
  });

  it("roundtrips a valid snapshot", async () => {
    const scope = { userId: "roundtrip-user", sucursalId: "north" };
    const snapshot = createDefaultQuickNotesSnapshot(
      scope,
      "2026-07-14T10:00:00.000Z",
    );
    snapshot.revision = 4;

    await expect(repository.save(scope, snapshot)).resolves.toEqual(snapshot);
    await expect(repository.load(scope)).resolves.toEqual({
      status: "found",
      snapshot,
    });
  });

  it("reports malformed data and preserves the exact raw value", async () => {
    const scope = { userId: "invalid-user", sucursalId: null };
    const key = quickNotesStorageKey(scope);
    const raw = "{not-json";
    storage.setItem(key, raw);

    const result = await repository.load(scope);

    expect(result.status).toBe("invalid");
    expect(storage.getItem(key)).toBe(raw);
  });

  it("rejects a valid snapshot stored under a different scope", async () => {
    const source = { userId: "scope-user", sucursalId: "north" };
    const target = { userId: "scope-user", sucursalId: "south" };
    const raw = JSON.stringify(createDefaultQuickNotesSnapshot(source));
    storage.setItem(quickNotesStorageKey(target), raw);

    const result = await repository.load(target);

    expect(result.status).toBe("invalid");
    expect(storage.getItem(quickNotesStorageKey(target))).toBe(raw);
  });

  it("distinguishes unavailable storage", async () => {
    const unavailable = new LocalStorageQuickNotesRepository(() => null);
    await expect(
      unavailable.load({ userId: "user", sucursalId: null }),
    ).resolves.toEqual({
      status: "unavailable",
      message: "Quick Notes storage is unavailable",
    });
  });
});
