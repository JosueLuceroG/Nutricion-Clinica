import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { SyncPushOperation } from "@nutriclinica/shared";
import type { DbSession } from "../../tenancy/application/tenantGuards.js";
import { applyWithReceipt, type SyncApplyResult } from "./syncReceipt.js";
import type { SyncActor } from "./syncAuthorization.js";

const branch = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";
const admin: SyncActor = { id: actorId, role: "admin" };
const v1 = Buffer.from("0000000000000001", "hex");
const v2 = Buffer.from("0000000000000002", "hex");

function fixture() {
  let row: Record<string, unknown> | undefined;
  const receipts = new Map<string, Record<string, unknown>>();
  const session = { request() {
    const params: Record<string, unknown> = {};
    return { input(name: string, _type: unknown, value: unknown) { params[name] = value; return this; },
      async query(text: string) {
        if (text.startsWith("SELECT profesional_id")) return { recordset: receipts.has(String(params.id)) ? [receipts.get(String(params.id))] : [] };
        if (text.startsWith("SELECT *")) return { recordset: row ? [row] : [] };
        if (text.startsWith("INSERT INTO audit_log")) {
          receipts.set(String(params.id), {
            profesional_id: params.actor,
            sucursal_id: params.branch,
            entity_type: "sync_receipt_v1",
            entity_id: params.entityId,
            operacion: "sync",
            detalles: params.details,
          });
          return { recordset: [] };
        }
        throw new Error("Unexpected receipt SQL");
      },
    };
  } } as unknown as DbSession;
  const op: SyncPushOperation = { operationId: randomUUID(), entity: "pacientes", id: randomUUID(), op: "create", payload: { first_name: "SYNTHETIC_CLINICAL_PAYLOAD" }, clientUpdatedAt: "2026-09-09T00:00:00.000Z" };
  const apply = vi.fn(async (): Promise<SyncApplyResult> => {
    row = { id: op.id, nombres: "SYNTHETIC_CLINICAL_PAYLOAD", row_version: v1, updated_at: new Date("2026-09-09"), deleted_at: null };
    return { entity: op.entity, id: op.id, status: "applied" };
  });
  return { session, op, apply, receipts, setRow: (next: Record<string, unknown> | undefined) => { row = next; }, run: (operation: SyncPushOperation = op, user: SyncActor = admin) => applyWithReceipt(session, branch, user, operation, apply) };
}

describe("durable operation receipt", () => {
  it("replays the same committed operation without another mutation", async () => {
    const f = fixture();
    const first = await f.run();
    expect(await f.run()).toEqual(first);
    expect(f.apply).toHaveBeenCalledTimes(1);
    expect(first.serverRowVersion).toBe(v1.toString("base64"));
    expect(String([...f.receipts.values()][0]!.detalles)).not.toContain("SYNTHETIC_CLINICAL_PAYLOAD");
  });
  it("rejects changed payload or different actor under the same UUID", async () => {
    const f = fixture();
    await f.run();
    expect(await f.run({ ...f.op, payload: { first_name: "different" } })).toMatchObject({ status: "error", error: "OPERATION_ID_REUSED" });
    expect(await f.run(f.op, { ...admin, id: randomUUID() })).toMatchObject({ status: "error", error: "OPERATION_ID_REUSED" });
    expect(f.apply).toHaveBeenCalledTimes(1);
  });
  it("requires identity before any domain write", async () => {
    const f = fixture();
    expect(await f.run({ ...f.op, operationId: undefined } as unknown as SyncPushOperation)).toMatchObject({ status: "error", error: "OPERATION_ID_REQUIRED" });
    expect(f.apply).not.toHaveBeenCalled();
  });
  it("does not infer a successful create from existing entity identity", async () => {
    const f = fixture();
    await f.run();
    expect(await f.run({ ...f.op, operationId: randomUUID() })).toMatchObject({ status: "conflict", error: "ENTITY_ALREADY_EXISTS" });
    expect(f.apply).toHaveBeenCalledTimes(1);
  });
  it("rejects missing/stale versions and provides explicit remote evidence", async () => {
    const f = fixture();
    f.setRow({ id: f.op.id, row_version: v2, updated_at: new Date(), deleted_at: null, nombres: "Remote" });
    expect(await f.run({ ...f.op, operationId: randomUUID(), op: "update" })).toMatchObject({ status: "conflict", error: "ROW_VERSION_REQUIRED", serverPayload: { first_name: "Remote" } });
    expect(await f.run({ ...f.op, operationId: randomUUID(), op: "update", expectedRowVersion: v1.toString("base64") })).toMatchObject({ status: "conflict", error: "ROW_VERSION_CONFLICT" });
    expect(f.apply).not.toHaveBeenCalled();
  });
  it("requires explicit restoration of an observed tombstone", async () => {
    const f = fixture();
    f.setRow({ id: f.op.id, row_version: v1, updated_at: new Date(), deleted_at: new Date() });
    const edit = { ...f.op, operationId: randomUUID(), op: "update" as const, expectedRowVersion: v1.toString("base64") };
    expect(await f.run(edit)).toMatchObject({ status: "conflict", error: "ENTITY_DELETED" });
    expect(await f.run({ ...edit, operationId: randomUUID(), restoreDeleted: true })).toMatchObject({ status: "applied" });
  });

  it("binds a terminal conflict to its original request digest", async () => {
    const f = fixture();
    const operationId = randomUUID();
    f.setRow({ id: f.op.id, row_version: v2, updated_at: new Date(), deleted_at: null, nombres: "Remote" });
    const stale = { ...f.op, operationId, op: "update" as const, expectedRowVersion: v1.toString("base64") };
    expect(await f.run(stale)).toMatchObject({ status: "conflict", error: "ROW_VERSION_CONFLICT" });
    expect(await f.run({ ...stale, payload: { first_name: "rebound" }, expectedRowVersion: v2.toString("base64") }))
      .toMatchObject({ status: "error", error: "OPERATION_ID_REUSED" });
    expect(f.apply).not.toHaveBeenCalled();
    expect(String(f.receipts.get(operationId)?.detalles)).not.toContain("Remote");
  });

  it("projects conflict evidence to the actor's writable scope", async () => {
    const f = fixture();
    f.setRow({
      id: f.op.id,
      row_version: v2,
      updated_at: new Date(),
      deleted_at: null,
      reason: "SENSITIVE_CLINICAL_REASON",
      subjective: "SENSITIVE_SOAP",
      payment_status: "partial",
      amount_paid: 250,
    });
    const operation = {
      ...f.op,
      operationId: randomUUID(),
      entity: "consultas" as const,
      op: "update" as const,
      payload: { payment_status: "paid" },
      expectedRowVersion: v1.toString("base64"),
    };
    const billing = await f.run(operation, { id: actorId, role: "facturacion" });
    expect(billing.serverPayload).toMatchObject({ payment_status: "partial", amount_paid: 250 });
    expect(billing.serverPayload).not.toHaveProperty("reason");
    expect(billing.serverPayload).not.toHaveProperty("subjective");

    const clinical = await f.run(
      { ...operation, operationId: randomUUID() },
      admin,
    );
    expect(clinical.serverPayload).toMatchObject({ reason: "SENSITIVE_CLINICAL_REASON" });
  });
  it("replays old acknowledgement after a newer remote change without attaching mismatched payload", async () => {
    const f = fixture();
    await f.run();
    f.setRow({ id: f.op.id, row_version: v2, updated_at: new Date(), deleted_at: null, nombres: "Newer remote" });
    const retry = await f.run();
    expect(retry.status).toBe("applied");
    expect(retry.serverRowVersion).toBe(v1.toString("base64"));
    expect(retry.serverPayload).toBeUndefined();
    expect(f.apply).toHaveBeenCalledTimes(1);
  });
  it("treats deletion of a missing entity as an explicit conflict", async () => {
    const f = fixture();
    f.setRow(undefined);
    expect(await f.run({ ...f.op, op: "delete" })).toMatchObject({
      status: "conflict",
      error: "ENTITY_NOT_FOUND",
      serverDeleted: true,
    });
    expect(f.apply).not.toHaveBeenCalled();
  });
  it("fails closed if an unrelated audit row collides with an operation UUID", async () => {
    const f = fixture();
    f.receipts.set(f.op.operationId!, {
      profesional_id: null,
      sucursal_id: null,
      entity_type: "unrelated_audit_event",
      detalles: "{}",
    });
    await expect(f.run()).resolves.toMatchObject({ status: "error", error: "OPERATION_ID_REUSED" });
    expect(f.apply).not.toHaveBeenCalled();
  });

  it("fails closed on a forged stored result instead of replaying payload fields", async () => {
    const f = fixture();
    await f.run();
    const saved = f.receipts.get(f.op.operationId)!;
    const details = JSON.parse(String(saved.detalles)) as {
      hash: string;
      result: Record<string, unknown>;
    };
    details.result.serverPayload = { reason: "FORGED_CLINICAL_PAYLOAD" };
    saved.detalles = JSON.stringify(details);

    expect(await f.run()).toMatchObject({
      status: "error",
      error: "OPERATION_ID_REUSED",
    });
    expect(f.apply).toHaveBeenCalledTimes(1);
  });

  it("binds receipt metadata to the exact entity identity", async () => {
    const f = fixture();
    await f.run();
    f.receipts.get(f.op.operationId)!.entity_id = randomUUID();
    expect(await f.run()).toMatchObject({
      status: "error",
      error: "OPERATION_ID_REUSED",
    });
  });
});
