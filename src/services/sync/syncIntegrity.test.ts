import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { SyncEngine } from "./syncEngine";
import { SyncQueueRepository } from "./syncQueueRepository";
import { markRemoteTransaction, SYNC_TABLES } from "./atomicOutbox";
import { useAuthStore } from "@store/authStore";
import { useSyncStore } from "@store/syncStore";
import { API_VERSION, SYNC_SCHEMA_VERSION, type SyncPushBatch, type SyncPushResponse, type SyncPullChange } from "@nutriclinica/shared";

const branch = "11111111-1111-4111-8111-111111111111";
const versionA = "AAAAAAAAAAE=";
const versionB = "AAAAAAAAAAI=";
const versionC = "AAAAAAAAAAM=";
let db: NutriClinicaDB;
let changes: SyncPullChange[];
let push: ReturnType<typeof vi.fn<(batch: SyncPushBatch) => Promise<SyncPushResponse>>>;
let engine: SyncEngine;
beforeEach(async () => {
  db = new NutriClinicaDB(`sync-integrity-${crypto.randomUUID()}`);
  db.syncOutboxEnabled = true;
  await db.open();
  useAuthStore.setState({ token: "synthetic-session", sucursalActivaId: branch });
  useSyncStore.getState().setSucursalId(branch);
  changes = [];
  push = vi.fn(async (batch: SyncPushBatch) => ({ serverTime: new Date().toISOString(), results: batch.operations.map((op) => ({
    operationId: op.operationId, entity: op.entity, id: op.id, status: "applied" as const,
    serverRowVersion: versionB, serverDeleted: op.op === "delete",
  })) }));
  engine = new SyncEngine({ db, queue: new SyncQueueRepository(db.sync_queue), getLastPullAt: () => null, setLastPullAt: () => {}, retrySleep: async () => {}, api: {
    manifest: async () => ({ apiVersion: "v1", apiContractVersion: API_VERSION, syncSchemaVersion: SYNC_SCHEMA_VERSION,
      operationContract: "durable-outbox-v1", entities: Object.values(SYNC_TABLES), maxBatchSize: 500, supportsDelta: true, serverTime: new Date().toISOString() }),
    pull: async () => ({ serverTime: new Date().toISOString(), changes, cursors: {}, hasMore: false }),
    push,
  } });
});
afterEach(async () => { await db.delete(); });

describe.each(Object.entries(SYNC_TABLES))("convergence %s", (table, entity) => {
  const value = () => ({ id: crypto.randomUUID(), sucursal_id: branch, notes: "A" });
  it("acknowledges revision N without consuming an in-flight edit N+1", async () => {
    const row = value();
    await db.table(table).put(row);
    let resolve!: (response: SyncPushResponse) => void;
    let sent!: SyncPushBatch;
    let started!: () => void;
    const waiting = new Promise<void>((done) => { started = done; });
    push.mockImplementationOnce((batch) => {
      sent = batch;
      started();
      return new Promise((done) => { resolve = done; });
    });
    const syncing = engine.sync();
    await waiting;
    await db.table(table).update(row.id, { notes: "B" });
    resolve({ serverTime: new Date().toISOString(), results: [{ operationId: sent.operations[0]!.operationId, entity, id: row.id, status: "applied", serverRowVersion: versionA }] });
    await syncing;
    const pending = await db.sync_queue.toArray();
    expect(pending).toHaveLength(1);
    expect(JSON.parse(pending[0]!.payload).notes).toBe("B");
    expect(pending[0]!.expectedRowVersion).toBe(versionA);
    expect((await db.table(table).get(row.id)).notes).toBe("B");
    expect(useSyncStore.getState().status).toBe("error");
    await engine.sync();
    expect(await db.sync_queue.count()).toBe(0);
    expect((await db.table(table).get(row.id)).row_version).toBe(versionB);
  });
  it("preserves dirty data while retaining remote conflict evidence", async () => {
    const row = value();
    await db.transaction("rw", db.table(table), async () => {
      markRemoteTransaction();
      await db.table(table).put({ ...row, row_version: versionA });
    });
    await db.table(table).update(row.id, { notes: "local offline edit" });
    changes = [{ entity, id: row.id, op: "update", payload: { ...row, notes: "remote" }, serverRowVersion: versionB, serverUpdatedAt: "2026-09-09T00:00:00.000Z" }];
    push.mockImplementationOnce(async (batch) => ({ serverTime: "2026-09-09T00:00:00.000Z", results: [{ operationId: batch.operations[0]!.operationId, entity, id: row.id, status: "conflict", serverRowVersion: versionB, serverPayload: changes[0]!.payload as Record<string, unknown>, serverDeleted: false }] }));
    await engine.sync();
    expect((await db.table(table).get(row.id)).notes).toBe("local offline edit");
    const [conflict] = await db.sync_queue.toArray();
    expect(conflict?.status).toBe("conflict");
    expect(conflict?.expectedRowVersion).toBe(versionA);
    expect(conflict?.serverPayload?.notes).toBe("remote");
    expect(useSyncStore.getState().status).toBe("error");
    await new SyncQueueRepository(db.sync_queue).resolveConflict(conflict!.id, "remote");
    expect((await db.table(table).get(row.id)).notes).toBe("remote");
  });
  it("pulls a server tombstone without re-enqueue or resurrection", async () => {
    const row = value();
    changes = [{ entity, id: row.id, op: "delete", payload: row, serverRowVersion: versionB, serverUpdatedAt: "2026-09-09T00:00:00.000Z" }];
    await engine.sync();
    expect((await db.table(table).get(row.id)).deleted_at).toBe("2026-09-09T00:00:00.000Z");
    expect(await db.sync_queue.count()).toBe(0);
    expect(push).not.toHaveBeenCalled();
  });
});

it("waits for patient and consultation parents before dispatching a plan", async () => {
  const patient = crypto.randomUUID();
  const consultation = crypto.randomUUID();
  await db.table("meal_plans").put({ id: crypto.randomUUID(), sucursal_id: branch, patient_id: patient, consultation_id: consultation, meals_json: "[]" });
  await db.table("consultations").put({ id: consultation, sucursal_id: branch, patient_id: patient, vitals_json: "{}" });
  await db.table("patients").put({ id: patient, sucursal_id: branch });
  await engine.sync();
  expect(push.mock.calls[0]![0].operations.map((op) => op.entity)).toEqual(["pacientes"]);
  await engine.sync();
  expect(push.mock.calls[1]![0].operations.map((op) => op.entity)).toEqual(["consultas"]);
  await engine.sync();
  expect(push.mock.calls[2]![0].operations[0]!.payload).toMatchObject({ consulta_id: consultation, meals: [] });
  expect(await db.sync_queue.count()).toBe(0);
});

it("dispatches child tombstones before consultation and patient parents", async () => {
  const patient = crypto.randomUUID();
  const consultation = crypto.randomUUID();
  const plan = crypto.randomUUID();
  await db.transaction("rw", [db.patients, db.consultations, db.meal_plans], async () => {
    markRemoteTransaction();
    await db.patients.put({ id: patient, sucursal_id: branch, row_version: versionA } as never);
    await db.consultations.put({ id: consultation, sucursal_id: branch, patient_id: patient, row_version: versionA } as never);
    await db.meal_plans.put({ id: plan, sucursal_id: branch, patient_id: patient, consultation_id: consultation, row_version: versionA } as never);
  });
  await db.patients.delete(patient);
  await db.consultations.delete(consultation);
  await db.meal_plans.delete(plan);
  await engine.sync();
  expect(push.mock.calls[0]![0].operations.map((op) => op.entity)).toEqual([
    "planes_alimenticios",
    "consultas",
    "pacientes",
  ]);
});

it("allows an attempted child revision to settle before a pending parent tombstone", async () => {
  const patient = crypto.randomUUID();
  const consultation = crypto.randomUUID();
  await db.transaction("rw", db.patients, async () => {
    markRemoteTransaction();
    await db.patients.put({ id: patient, sucursal_id: branch, row_version: versionA } as never);
  });
  await db.consultations.put({
    id: consultation,
    sucursal_id: branch,
    patient_id: patient,
    vitals_json: "{}",
  } as never);
  const childCreate = (await db.sync_queue.toArray())[0]!;
  const queue = new SyncQueueRepository(db.sync_queue);
  await queue.markSyncing(childCreate.id);
  await queue.markError(childCreate.id, "connection lost after dispatch");
  await db.consultations.delete(consultation);
  await db.patients.delete(patient);

  let cycle = 0;
  push.mockImplementation(async (batch) => {
    cycle++;
    return {
      serverTime: new Date().toISOString(),
      results: batch.operations.map((op) =>
        cycle === 1 && op.entity === "pacientes"
          ? {
              operationId: op.operationId,
              entity: op.entity,
              id: op.id,
              status: "error" as const,
              error: "active child",
            }
          : {
              operationId: op.operationId,
              entity: op.entity,
              id: op.id,
              status: "applied" as const,
              serverRowVersion: cycle === 1 ? versionB : versionC,
              serverDeleted: op.op === "delete",
            },
      ),
    };
  });

  await engine.sync();
  expect(push.mock.calls[0]![0].operations.map((op) => [op.entity, op.op])).toEqual([
    ["pacientes", "delete"],
    ["consultas", "create"],
  ]);

  await engine.sync();
  expect(push.mock.calls[1]![0].operations.map((op) => [op.entity, op.op])).toEqual([
    ["consultas", "delete"],
    ["pacientes", "delete"],
  ]);
  expect(await db.sync_queue.count()).toBe(0);
});

it("keeps a child blocked when its parent create conflicts", async () => {
  const patient = crypto.randomUUID();
  const consultation = crypto.randomUUID();
  await db.consultations.put({ id: consultation, sucursal_id: branch, patient_id: patient } as never);
  await db.patients.put({ id: patient, sucursal_id: branch, first_name: "Local" } as never);
  push.mockImplementationOnce(async (batch) => ({
    serverTime: new Date().toISOString(),
    results: [{
      operationId: batch.operations[0]!.operationId,
      entity: "pacientes",
      id: patient,
      status: "conflict",
      serverRowVersion: versionB,
      serverPayload: { id: patient, first_name: "Remote" },
      serverDeleted: false,
    }],
  }));
  await engine.sync();
  expect(push).toHaveBeenCalledTimes(1);
  await engine.sync();
  expect(push).toHaveBeenCalledTimes(1);
  expect((await db.sync_queue.toArray()).find((item) => item.entity === "consultas"))
    .toMatchObject({ status: "pending" });
});

it("rejects a non-bijective receipt before acknowledging any operation", async () => {
  const row = { id: crypto.randomUUID(), sucursal_id: branch, first_name: "Local" };
  await db.patients.put(row as never);
  push.mockImplementationOnce(async (batch) => ({
    serverTime: new Date().toISOString(),
    results: [
      { operationId: batch.operations[0]!.operationId, entity: "pacientes", id: row.id, status: "applied", serverRowVersion: versionB },
      { operationId: batch.operations[0]!.operationId, entity: "pacientes", id: row.id, status: "applied", serverRowVersion: versionB },
    ],
  }));
  await expect(engine.sync()).rejects.toThrow("INVALID_SYNC_RECEIPT_CARDINALITY");
  expect(await db.sync_queue.toArray()).toEqual([
    expect.objectContaining({ status: "error", attempted: true }),
  ]);
});

it("does not consume a delete acknowledgement without its tombstone version", async () => {
  const row = { id: crypto.randomUUID(), sucursal_id: branch, first_name: "Remote", row_version: versionA };
  await db.transaction("rw", db.patients, async () => {
    markRemoteTransaction();
    await db.patients.put(row as never);
  });
  await db.patients.delete(row.id);
  push.mockImplementationOnce(async (batch) => ({
    serverTime: new Date().toISOString(),
    results: [{ operationId: batch.operations[0]!.operationId, entity: "pacientes", id: row.id, status: "applied", serverDeleted: true }],
  }));
  await expect(engine.sync()).rejects.toThrow("INVALID_SYNC_RECEIPT_PAYLOAD");
  expect(await db.sync_queue.toArray()).toEqual([
    expect.objectContaining({ status: "error", lastError: "INVALID_SYNC_RECEIPT_PAYLOAD" }),
  ]);
});

it("promotes a successor to conflict when pull evidence is newer than a replayed acknowledgement", async () => {
  const row = { id: crypto.randomUUID(), sucursal_id: branch, first_name: "Base", row_version: versionA };
  await db.transaction("rw", db.patients, async () => {
    markRemoteTransaction();
    await db.patients.put(row as never);
  });
  await db.patients.update(row.id, { first_name: "Revision N" });
  const first = (await db.sync_queue.toArray())[0]!;
  await db.sync_queue.update(first.id, { status: "pending", attempted: true });
  await db.patients.update(row.id, { first_name: "Revision N+1" });
  changes = [{
    entity: "pacientes",
    id: row.id,
    op: "update",
    payload: { id: row.id, first_name: "Remote V3" },
    serverRowVersion: versionC,
    serverUpdatedAt: "2026-09-09T00:00:00.000Z",
  }];
  push.mockImplementationOnce(async (batch) => ({
    serverTime: new Date().toISOString(),
    results: [{
      operationId: batch.operations[0]!.operationId,
      entity: "pacientes",
      id: row.id,
      status: "applied",
      serverRowVersion: versionB,
      serverPayload: { id: row.id, first_name: "Revision N" },
    }],
  }));
  await engine.sync();
  const remaining = await db.sync_queue.toArray();
  expect(remaining).toEqual([expect.objectContaining({
    status: "conflict",
    serverRowVersion: versionC,
    serverPayload: { id: row.id, first_name: "Remote V3" },
  })]);
  expect(remaining[0]).not.toHaveProperty("predecessorId");
  expect(await db.patients.get(row.id)).toMatchObject({ first_name: "Revision N+1", row_version: versionC });
});

it("retains all six entity operations across a multi-day offline restart and converges", async () => {
  const ids = new Map<string, string>();
  for (const [table] of Object.entries(SYNC_TABLES)) {
    const id = crypto.randomUUID();
    ids.set(table, id);
    await db.table(table).put({ id, sucursal_id: branch, notes: "offline snapshot" } as never);
  }

  const offlineSince = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  await db.sync_queue.toCollection().modify({ enqueuedAt: offlineSince, updatedAt: offlineSince });
  db.close();
  await db.open();
  await engine.sync();
  expect(push).toHaveBeenCalledTimes(1);
  expect(new Set(push.mock.calls[0]![0].operations.map((op) => op.entity))).toEqual(new Set(Object.values(SYNC_TABLES)));
  expect(await db.sync_queue.count()).toBe(0);
  expect(useSyncStore.getState().status).toBe("idle");
  expect(useSyncStore.getState().pendingChanges).toBe(0);
  for (const [table, id] of ids) {
    expect((await db.table(table).get(id))?.row_version).toBe(versionB);
  }
});
