import type { SyncableEntity } from "./index.js";

export function canonicalSyncId(value: string): string {
  return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value) ? value.toLowerCase() : value;
}

export function isSyncRowVersion(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    const decoded = atob(value);
    return decoded.length === 8 && btoa(decoded) === value;
  } catch {
    return false;
  }
}

/** SQL-facing names belong to the API contract; JSON strings belong to Dexie. */
const JSON_FIELDS: Partial<
  Record<SyncableEntity, ReadonlyArray<readonly [string, string]>>
> = {
  consultas: [["vitals_json", "vitals"]],
  planes_alimenticios: [["meals_json", "meals"]],
  pacientes: [["clinical_tags", "clinical_tags"]],
};

function record(payload: unknown): Record<string, unknown> | null {
  if (payload === null) return null;
  if (typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid sync payload: expected a record or tombstone");
  }
  return { ...payload };
}

/** Never send both representations, and never silently replace corrupt JSON. */
export function toApiPayload(
  entity: SyncableEntity,
  payload: unknown,
): Record<string, unknown> | null {
  const row = record(payload);
  if (!row) return null;
  delete row._syncHead;
  delete row._syncNeverSynced;
  delete row.row_version;
  for (const [local, remote] of JSON_FIELDS[entity] ?? []) {
    if (local !== remote && remote in row) {
      throw new Error(`Non-canonical local sync field: ${remote}`);
    }
    if (!(local in row)) continue;
    const value = row[local];
    // Rows are allowed to contain null, but malformed serialized JSON must
    // leave the durable operation unresolved rather than becoming empty data.
    row[remote] = typeof value === "string" ? JSON.parse(value) : value;
    if (local !== remote) delete row[local];
  }
  if (entity === "planes_alimenticios") {
    if ("consulta_id" in row) {
      throw new Error("Non-canonical local sync field: consulta_id");
    }
    if ("consultation_id" in row) {
      row.consulta_id = row.consultation_id;
      delete row.consultation_id;
    }
  }
  return row;
}

export function toLocalPayload(
  entity: SyncableEntity,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const row = { ...payload };
  for (const [local, remote] of JSON_FIELDS[entity] ?? []) {
    if (local !== remote && local in row) {
      throw new Error(`Non-canonical API sync field: ${local}`);
    }
    if (!(remote in row)) continue;
    const value = row[remote];
    row[local] = value === null || value === undefined ? null : JSON.stringify(value);
    if (local !== remote) delete row[remote];
  }
  if (entity === "planes_alimenticios") {
    if ("consultation_id" in row) {
      throw new Error("Non-canonical API sync field: consultation_id");
    }
    if ("consulta_id" in row) {
      row.consultation_id = row.consulta_id;
      delete row.consulta_id;
    }
  }
  if (entity === "pacientes") {
    if (row.record_status === "open") row.record_status = "active";
    if (row.record_status === "closed") row.record_status = "inactive";
    if (!("discharge_reason" in row) && "record_closed_reason" in row) {
      row.discharge_reason = row.record_closed_reason;
      delete row.record_closed_reason;
    }
  }
  if (entity === "adherence_records") {
    for (const key of ["created_at", "updated_at"] as const) {
      if (typeof row[key] === "string") {
        const timestamp = Date.parse(row[key]);
        if (!Number.isNaN(timestamp)) row[key] = timestamp;
      }
    }
    if (typeof row.date === "string" && /^\d{4}-\d{2}-\d{2}T/.test(row.date)) {
      row.date = row.date.slice(0, 10);
    }
  }
  for (const key of ["id", "patient_id", "consultation_id", "anthropometry_id", "lab_panel_id"]) {
    if (typeof row[key] === "string") row[key] = canonicalSyncId(row[key]);
  }
  return row;
}
