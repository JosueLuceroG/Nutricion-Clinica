import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { markRemoteTransaction, SYNC_TABLES } from "./atomicOutbox";

let db: NutriClinicaDB;
const branch = "11111111-1111-4111-8111-111111111111";
beforeEach(async () => {
  db = new NutriClinicaDB(`atomic-outbox-${crypto.randomUUID()}`);
  db.syncOutboxEnabled = true;
  await db.open();
});
afterEach(async () => {
  await db.delete();
});

describe.each(Object.entries(SYNC_TABLES))("atomic outbox: %s", (tableName, entity) => {
  const row = () => ({
    id: crypto.randomUUID(),
    sucursal_id: branch,
    updated_at: tableName === "adherence_records" ? Date.now() : "2026-09-09T00:00:00.000Z",
  });
  it("commits entity and queue together, including implicit transactions", async () => {
    const value = row();
    await db.table(tableName).put(value);
    const saved = await db.table(tableName).get(value.id);
    const operations = await db.sync_queue.toArray();
    expect(operations).toHaveLength(1);
    expect(operations[0]).toMatchObject({ entity, entityId: value.id, op: "create", status: "pending" });
    expect(saved._syncHead).toBe(operations[0]!.id);
  });
  it("aborting after a mutation rolls back entity and outbox", async () => {
    const value = row();
    await expect(db.transaction("rw", db.table(tableName), async () => {
      await db.table(tableName).put(value);
      throw new Error("simulated crash before transaction commit");
    })).rejects.toThrow("simulated crash");
    expect(await db.table(tableName).get(value.id)).toBeUndefined();
    expect(await db.sync_queue.count()).toBe(0);
  });
  it("outbox write failure aborts the entity even if caller catches the error", async () => {
    const value = row();
    db.close();
    db.use({ stack: "dbcore", name: "fail-outbox", level: 0.5, create: (down) => ({
      ...down,
      table(name) {
        const table = down.table(name);
        return name === "sync_queue" ? { ...table, mutate: async () => { throw new Error("disk full"); } } : table;
      },
    }) });
    await db.open();
    await expect(db.table(tableName).put(value)).rejects.toThrow();
    expect(await db.table(tableName).get(value.id)).toBeUndefined();
  });
  it("coalesces unattempted writes but preserves a revision edited in flight", async () => {
    const value = row();
    await db.table(tableName).put({ ...value, name: "A" });
    await db.table(tableName).put({ ...value, name: "B" });
    const [first] = await db.sync_queue.toArray();
    expect(await db.sync_queue.count()).toBe(1);
    expect(JSON.parse(first!.payload).name).toBe("B");
    await db.sync_queue.update(first!.id, { status: "syncing", attempted: true });
    await db.table(tableName).put({ ...value, name: "C" });
    const operations = await db.sync_queue.toArray();
    expect(operations).toHaveLength(2);
    const successor = operations.find((item) => item.id !== first!.id)!;
    expect(successor.predecessorId).toBe(first!.id);
    expect(JSON.parse(successor.payload).name).toBe("C");
    expect(JSON.parse((await db.sync_queue.get(first!.id))!.payload).name).toBe("B");
  });
  it("preserves row_version when a domain mapper replaces the row", async () => {
    const value = row();
    await db.transaction("rw", db.table(tableName), async () => {
      markRemoteTransaction();
      await db.table(tableName).put({ ...value, row_version: "AAAAAAAAAAE=" });
    });
    expect(await db.sync_queue.count()).toBe(0);
    await db.table(tableName).put({ ...value, name: "edited" });
    expect((await db.table(tableName).get(value.id)).row_version).toBe("AAAAAAAAAAE=");
    expect((await db.sync_queue.toArray())[0]!.expectedRowVersion).toBe("AAAAAAAAAAE=");
  });
  it("keeps deletion of a server-observed row durable across restart", async () => {
    const value = { ...row(), row_version: "AAAAAAAAAAE=" };
    await db.transaction("rw", db.table(tableName), async () => {
      markRemoteTransaction();
      await db.table(tableName).put(value);
    });
    await db.table(tableName).delete(value.id);
    db.close();
    await db.open();
    const stored = await db.table(tableName).get(value.id);
    expect(stored.deleted_at).toBeTruthy();
    if (tableName === "adherence_records") expect(typeof stored.updated_at).toBe("number");
    expect(await db.sync_queue.toArray()).toEqual([expect.objectContaining({
      op: "delete",
      entityId: value.id,
      expectedRowVersion: "AAAAAAAAAAE=",
      attempted: false,
    })]);
  });
  it("atomically cancels create-delete before claim and restores it as create", async () => {
    const value = row();
    await db.table(tableName).put(value);
    await db.table(tableName).delete(value.id);
    expect(await db.sync_queue.count()).toBe(0);
    const tombstone = await db.table(tableName).get(value.id);
    expect(tombstone).toMatchObject({ deleted_at: expect.any(String), _syncNeverSynced: true });

    db.close();
    await db.open();
    await db.table(tableName).put({ ...tombstone, deleted_at: null });
    expect(await db.sync_queue.toArray()).toEqual([expect.objectContaining({
      op: "create",
      entityId: value.id,
      createsEntity: true,
      attempted: false,
    })]);
    expect((await db.table(tableName).get(value.id))._syncNeverSynced).toBeUndefined();
  });
  it("links delete after an attempted create instead of canceling it", async () => {
    const value = row();
    await db.table(tableName).put(value);
    const create = (await db.sync_queue.toArray())[0]!;
    await db.sync_queue.update(create.id, { status: "syncing", attempted: true });
    await db.table(tableName).delete(value.id);
    const operations = await db.sync_queue.toArray();
    expect(operations).toHaveLength(2);
    expect(operations.find((item) => item.id !== create.id)).toMatchObject({
      op: "delete",
      predecessorId: create.id,
      createsEntity: false,
    });
  });
  it("coalesces update-delete while retaining the original server version", async () => {
    const value = { ...row(), row_version: "AAAAAAAAAAE=" };
    await db.transaction("rw", db.table(tableName), async () => {
      markRemoteTransaction();
      await db.table(tableName).put(value);
    });
    await db.table(tableName).put({ ...value, notes: "edited" });
    await db.table(tableName).delete(value.id);
    expect(await db.sync_queue.toArray()).toEqual([expect.objectContaining({
      op: "delete",
      expectedRowVersion: "AAAAAAAAAAE=",
      attempted: false,
    })]);
  });
});

it("never rewrites a legacy operation whose attempted state is unknown", async () => {
  const id = crypto.randomUUID();
  const operationId = crypto.randomUUID();
  await db.transaction("rw", [db.patients, db.sync_queue], async () => {
    markRemoteTransaction();
    await db.patients.put({ id, sucursal_id: branch, first_name: "A", _syncHead: operationId } as never);
    await db.sync_queue.add({
      id: operationId,
      sucursalId: branch,
      entity: "pacientes",
      entityId: id,
      op: "update",
      payload: JSON.stringify({ id, first_name: "A" }),
      status: "pending",
      retryCount: 0,
      lastError: null,
      expectedRowVersion: "AAAAAAAAAAE=",
      enqueuedAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T00:00:00.000Z",
    });
  });
  await db.patients.update(id, { first_name: "B" });
  const operations = await db.sync_queue.toArray();
  expect(operations).toHaveLength(2);
  expect(JSON.parse((await db.sync_queue.get(operationId))!.payload).first_name).toBe("A");
  expect(operations.find((item) => item.id !== operationId)).toMatchObject({ predecessorId: operationId });
});

it("rejects duplicate entity keys before writing either row or outbox", async () => {
  const id = crypto.randomUUID();
  await expect(db.patients.bulkPut([
    { id, sucursal_id: branch, first_name: "A" },
    { id: id.toUpperCase(), sucursal_id: branch, first_name: "B" },
  ] as never)).rejects.toThrow("DUPLICATE_SYNC_KEYS_IN_MUTATION");
  expect(await db.patients.get(id)).toBeUndefined();
  expect(await db.patients.get(id.toUpperCase())).toBeUndefined();
  expect(await db.sync_queue.count()).toBe(0);
});

it("cancels an unattempted restoration back to its observed tombstone baseline", async () => {
  const id = crypto.randomUUID();
  await db.transaction("rw", db.patients, async () => {
    markRemoteTransaction();
    await db.patients.put({
      id,
      sucursal_id: branch,
      first_name: "Deleted",
      deleted_at: "2026-09-09T00:00:00.000Z",
      row_version: "AAAAAAAAAAE=",
    } as never);
  });
  await db.patients.update(id, { deleted_at: null, first_name: "Restored" });
  expect((await db.sync_queue.toArray())[0]).toMatchObject({ op: "update", restoreDeleted: true });
  await db.patients.update(id, { deleted_at: "2026-09-10T00:00:00.000Z" });
  expect(await db.sync_queue.count()).toBe(0);
  expect(await db.patients.get(id)).toMatchObject({ row_version: "AAAAAAAAAAE=" });

  await db.patients.update(id, { deleted_at: null, first_name: "Restored again" });
  expect((await db.sync_queue.toArray())[0]).toMatchObject({
    op: "update",
    restoreDeleted: true,
    expectedRowVersion: "AAAAAAAAAAE=",
  });
});

it("reactivates an exhausted stable predecessor when a newer edit is committed", async () => {
  const id = crypto.randomUUID();
  await db.transaction("rw", db.patients, async () => {
    markRemoteTransaction();
    await db.patients.put({ id, sucursal_id: branch, first_name: "Base", row_version: "AAAAAAAAAAE=" } as never);
  });
  await db.patients.update(id, { first_name: "A" });
  const first = (await db.sync_queue.toArray())[0]!;
  await db.sync_queue.update(first.id, { status: "error", attempted: true, retryCount: 8, lastError: "offline" });
  await db.patients.update(id, { first_name: "B" });
  const operations = await db.sync_queue.toArray();
  expect(await db.sync_queue.get(first.id)).toMatchObject({ status: "pending", retryCount: 0, attempted: true });
  expect(operations.find((item) => item.id !== first.id)).toMatchObject({ predecessorId: first.id, attempted: false });
});

it("fails closed when an entity head points at another queue lineage", async () => {
  const id = crypto.randomUUID();
  const foreignId = crypto.randomUUID();
  await db.transaction("rw", [db.patients, db.sync_queue], async () => {
    markRemoteTransaction();
    await db.patients.put({ id, sucursal_id: branch, first_name: "Base", _syncHead: foreignId } as never);
    await db.sync_queue.add({
      id: foreignId,
      sucursalId: branch,
      entity: "consultas",
      entityId: crypto.randomUUID(),
      op: "update",
      payload: "{}",
      status: "pending",
      attempted: false,
      retryCount: 0,
      lastError: null,
      expectedRowVersion: null,
      enqueuedAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T00:00:00.000Z",
    });
  });
  await expect(db.patients.update(id, { first_name: "Unsafe" })).rejects.toThrow("SYNC_LINEAGE_MISMATCH");
  expect((await db.patients.get(id))?.first_name).toBe("Base");
});
