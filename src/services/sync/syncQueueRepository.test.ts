import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  SyncQueueRepository,
  type EnqueueInput,
} from "./syncQueueRepository.js";
import { NutriClinicaDB } from "@services/db/dexieSchema";

describe("SyncQueueRepository", () => {
  let db: NutriClinicaDB;
  let repo: SyncQueueRepository;
  const enqueue = (
    input: Omit<EnqueueInput, "sucursalId">,
    sucursalId = "suc-1",
  ) => repo.enqueue({ ...input, sucursalId });

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-syncq-${Date.now()}-${Math.random()}`);
    await db.sync_queue.clear();
    repo = new SyncQueueRepository(db.sync_queue);
  });

  it("enqueue crea item con status=pending", async () => {
    const item = await enqueue({
      entity: "pacientes",
      entityId: "p1",
      op: "create",
      payload: { nombres: "Ana" },
    });
    expect(item.status).toBe("pending");
    expect(item.attempted).toBe(false);
    expect(item.createsEntity).toBe(true);
    expect(item.sucursalId).toBe("suc-1");
    expect(item.retryCount).toBe(0);
    expect(item.entity).toBe("pacientes");
    expect(item.entityId).toBe("p1");
    expect(item.op).toBe("create");
    expect(item.payload).toBe('{"nombres":"Ana"}');
    expect(item.enqueuedAt).toBeTruthy();
  });

  it("canonicaliza UUID de sucursal y encuentra registros legacy con otro casing", async () => {
    const upperBranch = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";
    const lowerBranch = upperBranch.toLowerCase();
    const entityId = "BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB";
    const item = await enqueue({
      entity: "pacientes",
      entityId,
      op: "create",
      payload: {},
    }, upperBranch);

    expect(item.sucursalId).toBe(lowerBranch);
    await db.sync_queue.update(item.id, { sucursalId: upperBranch });
    expect(await repo.listPending(lowerBranch)).toEqual([
      expect.objectContaining({ id: item.id }),
    ]);
    expect(await repo.findActiveByEntityId(lowerBranch, "pacientes", entityId.toLowerCase()))
      .toMatchObject({ id: item.id });
  });

  it("listPending excluye applied y conflict", async () => {
    const a = await enqueue({
      entity: "pacientes",
      entityId: "a",
      op: "create",
      payload: {},
    });
    const b = await enqueue({
      entity: "pacientes",
      entityId: "b",
      op: "create",
      payload: {},
    });
    const c = await enqueue({
      entity: "pacientes",
      entityId: "c",
      op: "create",
      payload: {},
    });
    await repo.markApplied(a.id);
    await repo.markConflict(c.id, "row_version mismatch");

    const pending = await repo.listPending("suc-1");
    expect(pending.map((i) => i.entityId).sort()).toEqual([b.entityId]);
  });

  it("countPending suma pending + error", async () => {
    await enqueue({
      entity: "pacientes",
      entityId: "1",
      op: "create",
      payload: {},
    });
    const err = await enqueue({
      entity: "pacientes",
      entityId: "2",
      op: "create",
      payload: {},
    });
    await repo.markError(err.id, "boom");
    expect(await repo.countPending("suc-1")).toBe(2);
  });

  it("countConflicts solo cuenta conflict", async () => {
    const c = await enqueue({
      entity: "pacientes",
      entityId: "c",
      op: "update",
      payload: {},
    });
    await repo.markConflict(c.id, "mismatch");
    const a = await enqueue({
      entity: "pacientes",
      entityId: "a",
      op: "create",
      payload: {},
    });
    await repo.markApplied(a.id);
    expect(await repo.countConflicts("suc-1")).toBe(1);
  });

  it("markError incrementa retryCount", async () => {
    const item = await enqueue({
      entity: "pacientes",
      entityId: "x",
      op: "create",
      payload: {},
    });
    await repo.markError(item.id, "timeout");
    await repo.markError(item.id, "timeout 2");
    const all = await repo.listAll();
    expect(all[0]!.retryCount).toBe(2);
    expect(all[0]!.lastError).toBe("timeout 2");
  });

  it("resolveConflict local \u2192 status=pending (reintenta)", async () => {
    const c = await enqueue({
      entity: "pacientes",
      entityId: "c",
      op: "update",
      payload: {},
    });
    await repo.markConflict(c.id, "mismatch", { serverRowVersion: "AAAAAAAAAAI=" });
    await repo.resolveConflict(c.id, "local");
    const items = await repo.listAll();
    expect(items[0]!.status).toBe("pending");
    expect(items[0]!.id).not.toBe(c.id);
    expect(items[0]!.expectedRowVersion).toBe("AAAAAAAAAAI=");
    expect(items[0]!.createsEntity).toBe(false);
  });

  it("resolveConflict remote instala la evidencia antes de retirar la operación", async () => {
    const c = await enqueue({
      entity: "pacientes",
      entityId: "c",
      op: "update",
      payload: {},
    });
    await repo.markConflict(c.id, "mismatch");
    await db.sync_queue.update(c.id, { serverPayload: { id: "c", first_name: "Remote" }, serverRowVersion: "AAAAAAAAAAI=" });
    await repo.resolveConflict(c.id, "remote");
    const items = await repo.listAll();
    expect(items).toHaveLength(0);
    expect((await db.patients.get("c"))?.first_name).toBe("Remote");
  });

  it("clearApplied borra solo applied", async () => {
    const a = await enqueue({
      entity: "pacientes",
      entityId: "a",
      op: "create",
      payload: {},
    });
    const b = await enqueue({
      entity: "pacientes",
      entityId: "b",
      op: "create",
      payload: {},
    });
    await repo.markApplied(a.id);
    const deleted = await repo.clearApplied("suc-1");
    expect(deleted).toBe(1);
    const remaining = await repo.listAll();
    expect(remaining.map((i) => i.entityId)).toEqual([b.entityId]);
  });

  it("aísla lecturas, conteos y limpieza por sucursal", async () => {
    const branchA = await enqueue(
      {
        entity: "pacientes",
        entityId: "shared",
        op: "update",
        payload: { branch: "A" },
      },
      "suc-A",
    );
    const branchB = await enqueue(
      {
        entity: "pacientes",
        entityId: "shared",
        op: "update",
        payload: { branch: "B" },
      },
      "suc-B",
    );
    await repo.markApplied(branchA.id);

    expect(await repo.listPending("suc-A")).toEqual([]);
    expect((await repo.listPending("suc-B")).map((item) => item.id)).toEqual([
      branchB.id,
    ]);
    expect(await repo.countPending("suc-B")).toBe(1);
    expect(await repo.clearApplied("suc-B")).toBe(0);
    expect(await repo.clearApplied("suc-A")).toBe(1);
    expect((await repo.listAll()).map((item) => item.id)).toEqual([branchB.id]);
  });

  it("no deduplica la misma entidad entre sucursales", async () => {
    await enqueue(
      { entity: "pacientes", entityId: "same-id", op: "update", payload: {} },
      "suc-A",
    );

    expect(
      await repo.findActiveByEntityId(
        "suc-B",
        "pacientes",
        "same-id",
        "update",
      ),
    ).toBeUndefined();
  });

  it("persiste status y evidencia de conflicto en una sola actualización", async () => {
    const item = await enqueue({ entity: "pacientes", entityId: "p", op: "update", payload: {} });
    await repo.markConflict(item.id, "ROW_VERSION_CONFLICT", {
      serverPayload: { id: "p", first_name: "Remote" },
      serverRowVersion: "AAAAAAAAAAI=",
      serverDeleted: false,
    });
    expect(await db.sync_queue.get(item.id)).toMatchObject({
      status: "conflict",
      lastError: "ROW_VERSION_CONFLICT",
      serverPayload: { first_name: "Remote" },
      serverRowVersion: "AAAAAAAAAAI=",
      serverDeleted: false,
    });
  });

  it("preserva payloads legacy de intento desconocido al recuperar syncing", async () => {
    const item = await enqueue({ entity: "pacientes", entityId: "p", op: "update", payload: { value: "A" } });
    await db.sync_queue.update(item.id, {
      status: "syncing",
      attempted: undefined,
      updatedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
    });
    expect(await repo.requeueStaleSyncing("suc-1")).toBe(1);
    expect(await db.sync_queue.get(item.id)).toMatchObject({ status: "pending", attempted: true });
  });

  it("rechaza limpiar o reconocer operaciones no resueltas", async () => {
    const item = await enqueue({ entity: "pacientes", entityId: "p", op: "create", payload: {} });
    await expect(repo.clearAll("suc-1")).rejects.toThrow("UNRESOLVED_SYNC_OPERATIONS_CANNOT_BE_DISCARDED");
    await expect(repo.removeAfterAcknowledgement(item.id)).rejects.toThrow("Only an attempted syncing operation");
    expect(await db.sync_queue.get(item.id)).toBeDefined();
  });

  it("pone en cuarentena IDs legacy malformados sin borrarlos", async () => {
    const item = await enqueue({ entity: "pacientes", entityId: "[object Object]", op: "update", payload: {} });
    expect(await repo.quarantineMalformed("suc-1")).toBe(1);
    expect(await db.sync_queue.get(item.id)).toMatchObject({
      status: "conflict",
      lastError: "MALFORMED_LEGACY_ENTITY_ID_REQUIRES_REVIEW",
    });
  });

  it("pone en cuarentena revisiones SQL malformadas antes del push", async () => {
    const item = await enqueue({
      entity: "pacientes",
      entityId: "p1",
      op: "update",
      payload: {},
      expectedRowVersion: "invalid",
    });

    expect(await repo.quarantineMalformed("suc-1")).toBe(1);
    expect(await db.sync_queue.get(item.id)).toMatchObject({
      status: "conflict",
      lastError: "MALFORMED_ROW_VERSION_REQUIRES_REVIEW",
    });
  });
});
