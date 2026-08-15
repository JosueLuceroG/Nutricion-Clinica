import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { SyncQueueRepository } from "@services/sync/syncQueueRepository";
import { SyncEnqueuer, setSyncApplying } from "@services/sync/syncEnqueuer";
import { useSyncStore } from "@store/syncStore";

function uuid(): string {
  return crypto.randomUUID();
}

describe("SyncEnqueuer", () => {
  let db: NutriClinicaDB;
  let enqueuer: SyncEnqueuer;
  let queue: SyncQueueRepository;

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-sync-${Math.random().toString(36).slice(2)}`);
    await db.open();
    await db.sync_queue.clear();
    queue = new SyncQueueRepository(db.sync_queue);
    useSyncStore.getState().setSucursalId("suc-1");
    enqueuer = new SyncEnqueuer(db, queue);
  });

  afterEach(async () => {
    enqueuer.stop();
    setSyncApplying(false);
    await db.delete();
  });

  it("encola un create cuando se inserta un paciente", async () => {
    enqueuer.start();
    const id = uuid();
    await db.patients.add({ id, first_name: "Ana" } as never);
    await new Promise((r) => setTimeout(r, 30));
    const items = await db.sync_queue.toArray();
    expect(items.length).toBe(1);
    expect(items[0]).toMatchObject({
      entity: "pacientes",
      entityId: id,
      op: "create",
    });
  });

  it("dedupe: si ya hay un item activo para (entity, entityId, op), no encola otro", async () => {
    enqueuer.start();
    const id = uuid();
    // Pre-poblamos la cola con un item activo (simula que el engine está
    // procesando un create para este id). El hook del próximo add con
    // mismo id + op='create' debería detectar que ya hay uno y no encolar.
    await queue.enqueue({
      sucursalId: "suc-1",
      entity: "pacientes",
      entityId: id,
      op: "create",
      payload: { id, first_name: "pre-existing" },
    });
    await db.sync_queue.update((await db.sync_queue.toArray())[0]!.id, {
      status: "syncing",
    });

    // Disparamos el hook manualmente con el mismo (entity, id, op='create')
    // para simular que múltiples instancias del enqueuer se engancharon
    // y procesan la misma mutación.
    const patientTable = (
      db as unknown as { patients: { add: (v: unknown) => Promise<unknown> } }
    ).patients;
    await patientTable.add({ id, first_name: "Ana" } as never);
    await new Promise((r) => setTimeout(r, 50));

    const items = await db.sync_queue.toArray();
    // Sigue habiendo un solo item: el dedupe bloqueó el segundo enqueue
    expect(items.length).toBe(1);
    expect(items[0]!.entityId).toBe(id);
    expect(items[0]!.status).toBe("syncing");
  });

  it("captura la sucursal al ocurrir la mutación aunque cambie antes del enqueue", async () => {
    enqueuer.start();
    const id = uuid();
    useSyncStore.getState().setSucursalId("suc-A");
    await db.patients.add({
      id,
      sucursal_id: "suc-A",
      first_name: "Ana",
    } as never);
    useSyncStore.getState().setSucursalId("suc-B");
    await new Promise((r) => setTimeout(r, 30));

    expect(await db.sync_queue.toArray()).toMatchObject([
      { entityId: id, sucursalId: "suc-A" },
    ]);
  });

  it("NO encola cuando __syncApplying=true (round-trip del engine)", async () => {
    enqueuer.start();
    setSyncApplying(true);
    try {
      const id = uuid();
      await db.patients.add({ id, first_name: "Beto" } as never);
      await new Promise((r) => setTimeout(r, 30));
      const items = await db.sync_queue.toArray();
      expect(items.length).toBe(0);
    } finally {
      setSyncApplying(false);
    }
  });

  it("encola el paciente actualizado y no la versión anterior", async () => {
    enqueuer.start();
    const id = uuid();
    await db.patients.add({
      id,
      first_name: "Ana",
      general_notes: null,
    } as never);
    await new Promise((r) => setTimeout(r, 30));
    await db.sync_queue.clear();

    await db.patients.update(id, {
      first_name: "Ana María",
      general_notes: "Seguimiento actualizado",
    } as never);
    await new Promise((r) => setTimeout(r, 30));

    const items = await db.sync_queue.toArray();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      entity: "pacientes",
      entityId: id,
      op: "update",
    });
    expect(JSON.parse(items[0]!.payload ?? "{}")).toMatchObject({
      id,
      first_name: "Ana María",
      general_notes: "Seguimiento actualizado",
    });
  });

  it("consolida actualizaciones pendientes con el estado más reciente", async () => {
    enqueuer.start();
    const id = uuid();
    await db.patients.add({
      id,
      first_name: "Ana",
      general_notes: null,
    } as never);
    await new Promise((r) => setTimeout(r, 30));
    await db.sync_queue.clear();

    await db.patients.update(id, { first_name: "Ana María" } as never);
    await new Promise((r) => setTimeout(r, 30));
    await db.patients.update(id, {
      first_name: "Ana María López",
      general_notes: "Versión definitiva",
    } as never);
    await new Promise((r) => setTimeout(r, 30));

    const items = await db.sync_queue.toArray();
    expect(items).toHaveLength(1);
    expect(items[0]!.op).toBe("update");
    expect(JSON.parse(items[0]!.payload ?? "{}")).toMatchObject({
      id,
      first_name: "Ana María López",
      general_notes: "Versión definitiva",
    });
  });

  it("encola un delete cuando se borra un paciente", async () => {
    enqueuer.start();
    const id = uuid();
    await db.patients.add({ id } as never);
    await new Promise((r) => setTimeout(r, 20));
    await db.patients.delete(id);
    await new Promise((r) => setTimeout(r, 20));
    const items = await db.sync_queue.toArray();
    const ops = items.map((i) => i.op).sort();
    expect(ops).toEqual(["create", "delete"]);
  });

  it("stop() desactiva enqueue (no encola más)", async () => {
    enqueuer.start();
    enqueuer.stop();
    const id = uuid();
    await db.patients.add({ id } as never);
    await new Promise((r) => setTimeout(r, 30));
    const items = await db.sync_queue.toArray();
    expect(items.length).toBe(0);
  });
});
