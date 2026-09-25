import { createHash } from "node:crypto";
import sql from "mssql";
import {
  canonicalSyncId,
  type SyncPushOperation,
  type SyncPushResultItem,
} from "@nutriclinica/shared";
import type { DbSession } from "../../tenancy/application/tenantGuards.js";
import { dbRowToClient } from "./entityColumnMaps.js";
import {
  projectSyncServerPayload,
  type SyncActor,
} from "./syncAuthorization.js";

const TABLES = new Set(["pacientes", "consultas", "antropometrias", "lab_panels", "planes_alimenticios", "adherence_records"]);
const RECEIPT_RESULT_FIELDS = new Set([
  "operationId",
  "entity",
  "id",
  "status",
  "serverUpdatedAt",
  "serverRowVersion",
  "error",
  "serverDeleted",
]);

export type SyncApplyResult = Omit<SyncPushResultItem, "operationId"> & {
  operationId?: string;
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isRowVersion(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const decoded = Buffer.from(value, "base64");
    return decoded.length === 8 && decoded.toString("base64") === value;
  } catch {
    return false;
  }
}

function parseStoredResult(
  value: unknown,
  op: SyncPushOperation,
): SyncPushResultItem | null {
  if (!isRecord(value) || Object.keys(value).some((key) => !RECEIPT_RESULT_FIELDS.has(key))) {
    return null;
  }
  if (
    typeof value.operationId !== "string" ||
    canonicalSyncId(value.operationId) !== canonicalSyncId(op.operationId) ||
    value.entity !== op.entity ||
    typeof value.id !== "string" ||
    canonicalSyncId(value.id) !== canonicalSyncId(op.id) ||
    (value.status !== "applied" && value.status !== "conflict") ||
    typeof value.serverDeleted !== "boolean" ||
    (value.serverRowVersion !== undefined && !isRowVersion(value.serverRowVersion)) ||
    (value.status === "applied" && !isRowVersion(value.serverRowVersion)) ||
    (value.serverUpdatedAt !== undefined &&
      (typeof value.serverUpdatedAt !== "string" || Number.isNaN(Date.parse(value.serverUpdatedAt)))) ||
    (value.error !== undefined && typeof value.error !== "string") ||
    (value.status === "conflict" && typeof value.error !== "string")
  ) {
    return null;
  }
  return {
    operationId: value.operationId,
    entity: op.entity,
    id: value.id,
    status: value.status,
    ...(value.serverUpdatedAt !== undefined ? { serverUpdatedAt: value.serverUpdatedAt } : {}),
    ...(value.serverRowVersion !== undefined ? { serverRowVersion: value.serverRowVersion } : {}),
    ...(value.error !== undefined ? { error: value.error } : {}),
    serverDeleted: value.serverDeleted,
  };
}

/**
 * An audit_log row with the operation UUID is the committed receipt. It stores
 * a request digest and version metadata only, never the clinical payload.
 * Both the receipt and domain mutation commit in the caller's SQL transaction.
 */
export async function applyWithReceipt(
  session: DbSession,
  branch: string,
  actor: SyncActor,
  op: SyncPushOperation,
  apply: () => Promise<SyncApplyResult>,
  beforeEntityLock?: () => Promise<void>,
): Promise<SyncPushResultItem> {
  const base = { operationId: op.operationId, entity: op.entity, id: op.id };
  if (!op.operationId) return { ...base, status: "error", error: "OPERATION_ID_REQUIRED" };
  if (!TABLES.has(op.entity)) throw new Error("Unknown sync entity");
  const hash = createHash("sha256").update(canonical({
    entity: op.entity, id: canonicalSyncId(op.id), op: op.op, payload: op.payload,
    expectedRowVersion: op.expectedRowVersion,
    restoreDeleted: op.restoreDeleted === true,
  })).digest("hex");
  const read = () => session.request()
    .input("id", sql.UniqueIdentifier, op.id)
    .input("branch", sql.UniqueIdentifier, branch)
    .query<Record<string, unknown>>(`SELECT * FROM ${op.entity} WITH (UPDLOCK, HOLDLOCK) WHERE id = @id AND sucursal_id = @branch`);

  const receipt = await session.request()
    .input("id", sql.UniqueIdentifier, op.operationId)
    .query<{ profesional_id: string; sucursal_id: string; entity_type: string; entity_id: string; operacion: string; detalles: string }>(
      "SELECT profesional_id, sucursal_id, entity_type, entity_id, operacion, detalles FROM audit_log WITH (UPDLOCK, HOLDLOCK) WHERE id = @id",
    );
  if (receipt.recordset[0]) {
    const saved = receipt.recordset[0];
    if (saved.entity_type !== "sync_receipt_v1" || saved.operacion !== "sync" ||
      typeof saved.entity_id !== "string" || canonicalSyncId(saved.entity_id) !== canonicalSyncId(op.id) ||
      typeof saved.profesional_id !== "string" ||
      typeof saved.sucursal_id !== "string" || saved.profesional_id.toLowerCase() !== actor.id.toLowerCase() ||
      saved.sucursal_id.toLowerCase() !== branch.toLowerCase()) {
      return { ...base, status: "error", error: "OPERATION_ID_REUSED" };
    }
    let details: { hash: unknown; result: unknown };
    try {
      details = JSON.parse(saved.detalles) as { hash: unknown; result: unknown };
      if (typeof details.hash !== "string" || !/^[0-9a-f]{64}$/.test(details.hash)) {
        throw new Error("Malformed receipt");
      }
    } catch {
      return { ...base, status: "error", error: "OPERATION_ID_REUSED" };
    }
    if (details.hash !== hash) return { ...base, status: "error", error: "OPERATION_ID_REUSED" };
    const storedResult = parseStoredResult(details.result, op);
    if (!storedResult) return { ...base, status: "error", error: "OPERATION_ID_REUSED" };
    const live = (await read()).recordset[0];
    const liveVersion = live?.row_version ? Buffer.from(live.row_version as Uint8Array).toString("base64") : undefined;
    return { ...storedResult, ...(liveVersion === storedResult.serverRowVersion ? {
      serverPayload: live
        ? projectSyncServerPayload(op.entity, dbRowToClient(op.entity, live), actor.role)
        : null,
    } : {}) };
  }
  await beforeEntityLock?.();
  const current = (await read()).recordset[0];
  const version = current?.row_version ? Buffer.from(current.row_version as Uint8Array).toString("base64") : undefined;
  const persist = async (result: SyncPushResultItem): Promise<void> => {
    const stored = { ...result };
    delete stored.serverPayload;
    await session.request()
      .input("id", sql.UniqueIdentifier, op.operationId)
      .input("actor", sql.UniqueIdentifier, actor.id)
      .input("branch", sql.UniqueIdentifier, branch)
      .input("entityId", sql.UniqueIdentifier, op.id)
      .input("details", sql.NVarChar(sql.MAX), JSON.stringify({ hash, result: stored }))
      .query("INSERT INTO audit_log (id, profesional_id, sucursal_id, entity_type, entity_id, operacion, detalles) VALUES (@id, @actor, @branch, 'sync_receipt_v1', @entityId, 'sync', @details)");
  };
  const conflict = async (error: string): Promise<SyncPushResultItem> => {
    const result: SyncPushResultItem = {
      ...base, status: "conflict", error, serverRowVersion: version,
      serverUpdatedAt: current?.updated_at instanceof Date ? current.updated_at.toISOString() : undefined,
      serverDeleted: !current || current.deleted_at != null,
    };
    await persist(result);
    return {
      ...result,
      serverPayload: current
        ? projectSyncServerPayload(op.entity, dbRowToClient(op.entity, current), actor.role)
        : null,
    };
  };
  // Replays are handled above, not inferred from entity existence.
  if (op.op === "create" && current) return conflict("ENTITY_ALREADY_EXISTS");
  if (op.op !== "create" && current) {
    if (!op.expectedRowVersion) return conflict("ROW_VERSION_REQUIRED");
    if (op.expectedRowVersion !== version) return conflict("ROW_VERSION_CONFLICT");
    if (current.deleted_at && op.op !== "delete" && !op.restoreDeleted) return conflict("ENTITY_DELETED");
    if (!current.deleted_at && op.restoreDeleted) return conflict("ENTITY_NOT_DELETED");
  }
  if (!current && op.op === "update") return conflict("ENTITY_NOT_FOUND");
  if (!current && op.op === "delete") return conflict("ENTITY_NOT_FOUND");

  const result = await apply();
  if (result.status !== "applied") return { ...result, operationId: op.operationId };
  const after = (await read()).recordset[0];
  const acknowledged: SyncPushResultItem = {
    ...result, operationId: op.operationId,
    serverRowVersion: after?.row_version ? Buffer.from(after.row_version as Uint8Array).toString("base64") : undefined,
    serverUpdatedAt: after?.updated_at instanceof Date ? after.updated_at.toISOString() : undefined,
    serverDeleted: !after || after.deleted_at != null,
  };
  await persist(acknowledged);
  return {
    ...acknowledged,
    serverPayload: after
      ? projectSyncServerPayload(op.entity, dbRowToClient(op.entity, after), actor.role)
      : null,
  };
}
