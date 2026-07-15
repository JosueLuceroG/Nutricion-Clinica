import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultDashboardQuickAccessSnapshot } from "../domain";
import {
  LocalStorageDashboardQuickAccessRepository,
  dashboardQuickAccessStorageKey,
  type DashboardQuickAccessStorage,
} from "./LocalStorageDashboardQuickAccessRepository";

class MemoryStorage implements DashboardQuickAccessStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("LocalStorageDashboardQuickAccessRepository", () => {
  let storage: MemoryStorage;
  let repository: LocalStorageDashboardQuickAccessRepository;

  beforeEach(() => {
    storage = new MemoryStorage();
    repository = new LocalStorageDashboardQuickAccessRepository(() => storage);
  });

  it("isolates encoded user, branch, and null-branch keys", async () => {
    const globalScope = { userId: "user:1", sucursalId: null };
    const namedGlobalScope = { userId: "user:1", sucursalId: "none" };
    const otherUser = { userId: "user", sucursalId: "1:none" };

    await repository.save(
      globalScope,
      createDefaultDashboardQuickAccessSnapshot(globalScope),
    );
    await repository.save(
      namedGlobalScope,
      createDefaultDashboardQuickAccessSnapshot(namedGlobalScope),
    );
    await repository.save(
      otherUser,
      createDefaultDashboardQuickAccessSnapshot(otherUser),
    );

    expect(
      new Set([
        dashboardQuickAccessStorageKey(globalScope),
        dashboardQuickAccessStorageKey(namedGlobalScope),
        dashboardQuickAccessStorageKey(otherUser),
      ]).size,
    ).toBe(3);
    await expect(
      repository.load({ userId: "missing", sucursalId: null }),
    ).resolves.toEqual({ status: "missing" });
  });

  it("roundtrips a valid snapshot", async () => {
    const scope = { userId: "roundtrip-user", sucursalId: "north" };
    const snapshot = createDefaultDashboardQuickAccessSnapshot(
      scope,
      "2026-07-14T10:00:00.000Z",
    );
    snapshot.config.mode = "menu";
    snapshot.config.secondaryActionIds = ["dashboard.home.open"];
    snapshot.revision = 4;

    await expect(repository.save(scope, snapshot)).resolves.toEqual(snapshot);
    await expect(repository.load(scope)).resolves.toEqual({
      status: "found",
      snapshot,
    });
  });

  it("preserves malformed and future-version raw data", async () => {
    const scope = { userId: "invalid-user", sucursalId: null };
    const key = dashboardQuickAccessStorageKey(scope);
    const malformed = "{not-json";
    storage.setItem(key, malformed);

    expect((await repository.load(scope)).status).toBe("invalid");
    expect(storage.getItem(key)).toBe(malformed);

    const future = JSON.stringify({
      ...createDefaultDashboardQuickAccessSnapshot(scope),
      schemaVersion: 2,
    });
    storage.setItem(key, future);

    expect((await repository.load(scope)).status).toBe("invalid");
    expect(storage.getItem(key)).toBe(future);
  });

  it("rejects a snapshot stored under a different scope without rewriting it", async () => {
    const source = { userId: "scope-user", sucursalId: "north" };
    const target = { userId: "scope-user", sucursalId: "south" };
    const raw = JSON.stringify(
      createDefaultDashboardQuickAccessSnapshot(source),
    );
    const key = dashboardQuickAccessStorageKey(target);
    storage.setItem(key, raw);

    expect((await repository.load(target)).status).toBe("invalid");
    expect(storage.getItem(key)).toBe(raw);
  });

  it("distinguishes unavailable storage for loads and saves", async () => {
    const scope = { userId: "user", sucursalId: null };
    const unavailable = new LocalStorageDashboardQuickAccessRepository(
      () => null,
    );

    await expect(unavailable.load(scope)).resolves.toEqual({
      status: "unavailable",
      message: "Dashboard quick access storage is unavailable",
    });
    await expect(
      unavailable.save(scope, createDefaultDashboardQuickAccessSnapshot(scope)),
    ).rejects.toMatchObject({
      name: "DashboardQuickAccessRepositoryError",
      code: "unavailable",
    });
  });

  it("rejects a stale revision instead of overwriting another window", async () => {
    const scope = { userId: "conflict-user", sucursalId: "north" };
    const loaded = createDefaultDashboardQuickAccessSnapshot(scope);
    loaded.revision = 1;
    await repository.save(scope, loaded);

    const firstSave = createDefaultDashboardQuickAccessSnapshot(scope);
    firstSave.revision = 2;
    await repository.save(scope, firstSave);

    const staleSave = createDefaultDashboardQuickAccessSnapshot(scope);
    staleSave.revision = 2;
    await expect(repository.save(scope, staleSave)).rejects.toMatchObject({
      code: "conflict",
    });
    await expect(repository.load(scope)).resolves.toEqual({
      status: "found",
      snapshot: firstSave,
    });
  });
});
