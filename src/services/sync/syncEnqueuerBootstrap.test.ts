import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "fake-indexeddb/auto";
import {
  getSyncEnqueuer,
  __resetSyncEnqueuerForTests,
} from "@services/sync/syncEnqueuerBootstrap";
import { db } from "@services/db";
import { SyncEnqueuer } from "@services/sync/syncEnqueuer";

describe("syncEnqueuerBootstrap", () => {
  beforeEach(() => {
    __resetSyncEnqueuerForTests();
  });

  afterEach(() => {
    __resetSyncEnqueuerForTests();
  });

  it("retorna la misma instancia en llamadas sucesivas (singleton)", () => {
    const a = getSyncEnqueuer();
    const b = getSyncEnqueuer();
    expect(a).toBe(b);
  });

  it("start() solo se ejecuta una vez para el singleton (re-llamar getSyncEnqueuer no duplica hooks)", async () => {
    // Espiamos el método start en el prototipo para contar invocaciones.
    // Si el singleton respeta la invariante "start una sola vez", el
    // contador debe ser exactamente 1 tras múltiples getSyncEnqueuer().
    const startSpy = vi.spyOn(SyncEnqueuer.prototype, "start");
    try {
      getSyncEnqueuer();
      getSyncEnqueuer();
      getSyncEnqueuer();
      expect(startSpy).toHaveBeenCalledTimes(1);
    } finally {
      startSpy.mockRestore();
    }
  });

  it("la instancia singleton está conectada a db (cambios encolan items)", async () => {
    const enqueuer = getSyncEnqueuer();
    expect(enqueuer).toBeInstanceOf(SyncEnqueuer);
    const id = crypto.randomUUID();
    await db.patients.add({ id, first_name: "Singleton Test" } as never);
    // Esperar a que el microtask deferido se procese.
    await new Promise((r) => setTimeout(r, 30));
    const all = await db.sync_queue.toArray();
    const items = all.filter((i) => i.entityId === id);
    expect(items.length).toBe(1);
    expect(items[0]).toMatchObject({ entity: "pacientes", op: "create" });
  });

  it("__resetSyncEnqueuerForTests() detiene y resetea el singleton", () => {
    const first = getSyncEnqueuer();
    __resetSyncEnqueuerForTests();
    const second = getSyncEnqueuer();
    expect(second).not.toBe(first);
  });
});
