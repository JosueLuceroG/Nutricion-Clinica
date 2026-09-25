/**
 * SyncEngine: orquesta pull + push entre Dexie local y el backend.
 *
 * Flujo por ciclo (sync()):
 *   1. Si no hay token \u2192 noop (usuario no autenticado).
 *   2. GET /sync/manifest \u2192 valida SYNC_SCHEMA_VERSION.
 *   3. Pull: GET /sync/pull?since=<cursors por entidad>; aplica cada cambio a
 *      la tabla correspondiente en una transacción marcada como remota,
 *      en una sola transacción Dexie por lote.
 *   4. Push: lee sync_queue donde status IN (pending, error), arma el batch,
 *      POST /sync/push; actualiza status seg\u00fan resultado.
 *   5. Actualiza syncStore (status, lastSyncAt, pendingChanges).
 *
 * Reintentos: el push se envuelve en withRetry. Network/auth/schema-mismatch
 * son las 3 clases de error que el engine sabe distinguir.
 */

import type { NutriClinicaDB } from "@services/db/dexieSchema";
import type { SyncQueueItem, SyncOp } from "@modules/sync/domain/SyncQueueItem";
import {
  SYNCABLE_ENTITIES,
  type SyncableEntity,
  type SyncPullCursors,
} from "@nutriclinica/shared";
import type {
  SyncPullChange,
  SyncPushOperation,
  SyncPushResultItem,
} from "@nutriclinica/shared";
import { SYNC_SCHEMA_VERSION, API_VERSION, SYNC_OPERATION_CONTRACT } from "@nutriclinica/shared";
import { type SyncQueueRepository } from "./syncQueueRepository.js";
import {
  isSyncApplying,
  setSyncRunning,
} from "./syncEnqueuer.js";
import { withDatabaseOperationLock } from "./databaseOperationLock.js";
import { type syncApi } from "./syncApiClient.js";
import { withRetry } from "./backoff.js";
import { useAuthStore } from "@store/authStore";
import { useSyncStore } from "@store/syncStore";
import { withSucursalScope } from "@services/tenancy/sucursalScope";
import {
  SyncAuthError,
  SyncSchemaMismatchError,
  ApiContractMismatchError,
} from "@modules/sync/domain/errors.js";
import { HttpError, NetworkError } from "../api/httpClient.js";
import { canonicalSyncId, isSyncRowVersion, toApiPayload, toLocalPayload } from "./syncPayloadMapping.js";
import { markRemoteTransaction } from "./atomicOutbox.js";
import { isLocalContextTransitioning } from "@services/security/localContextState";

const PUSH_MAX_BATCH = 500;
const MAX_PUSH_RETRIES = 4;
const ROW_VERSION_BYTES = 8;

const ENTITY_TO_TABLE: Record<SyncableEntity, keyof NutriClinicaDB & string> = {
  pacientes: "patients",
  consultas: "consultations",
  antropometrias: "anthropometry",
  lab_panels: "lab_panels",
  planes_alimenticios: "meal_plans",
  adherence_records: "adherence_records",
};

async function localIdentities(db: NutriClinicaDB): Promise<Map<string, Map<string, string>>> {
  const maps = new Map<string, Map<string, string>>();
  for (const name of Object.values(ENTITY_TO_TABLE)) {
    const map = new Map<string, string>();
    for (const key of await db.table(name).toCollection().primaryKeys()) {
      const id = String(key);
      const normalized = canonicalSyncId(id);
      if (map.has(normalized)) throw new Error(`DUPLICATE_LOCAL_UUID in ${name}: operator review required`);
      map.set(normalized, id);
    }
    maps.set(name, map);
  }
  return maps;
}

function bindLocalIdentities(row: Record<string, unknown>, table: string, maps: Map<string, Map<string, string>>): Record<string, unknown> {
  const result = { ...row };
  for (const [key, target] of Object.entries({ id: table, patient_id: "patients", consultation_id: "consultations", anthropometry_id: "anthropometry", lab_panel_id: "lab_panels" })) {
    if (typeof result[key] === "string") result[key] = maps.get(target)?.get(canonicalSyncId(result[key])) ?? canonicalSyncId(result[key]);
  }
  return result;
}

/**
 * Convierte un payload de pull del servidor (campo camelCase, JSON columns
 * como objetos parseados) al formato de row local que el mapper espera
 * (snake_case, JSON columns como strings).
 *
 * El servidor aplica `parse: jsonParse` en ColumnSpec para devolver
 * objetos/arrays, pero el cliente guarda esas mismas columnas como strings
 * (JSON.stringify) en Dexie. Sin esta conversión, los mappers leen
 * `undefined` y los datos JSON se pierden.
 */
export interface SyncEngineDeps {
  db: NutriClinicaDB;
  queue: SyncQueueRepository;
  /** Cursors de pull por entidad persistidos (null la primera vez = pull completo). */
  getLastPullAt: (
    sucursalId: string,
  ) => SyncPullCursors | null | Promise<SyncPullCursors | null>;
  setLastPullAt: (
    sucursalId: string,
    cursors: SyncPullCursors,
  ) => void | Promise<void>;
  /** Caller puede sobreescribir el cliente HTTP (test). */
  api?: typeof syncApi;
  /** Hook opcional para notificar al UI. */
  onProgress?: (event: SyncEvent) => void;
  /** Inyectable para tests; por defecto backoff exponencial real (1s→60s + jitter). */
  retrySleep?: (ms: number) => Promise<void>;
}

export type SyncEvent =
  | { type: "start" }
  | { type: "manifest"; serverTime: string }
  | { type: "pull"; received: number }
  | {
      type: "push";
      sent: number;
      applied: number;
      conflicts: number;
      errors: number;
    }
  | { type: "done"; durationMs: number }
  | { type: "error"; error: string };

export class SyncEngine {
  private running = false;
  private inFlight: Promise<void> | null = null;

  constructor(private readonly deps: SyncEngineDeps) {}

  isRunning(): boolean {
    return this.running;
  }

  async sync(): Promise<void> {
    if (isSyncApplying()) return;
    if (this.inFlight) return this.inFlight;
    this.inFlight = withDatabaseOperationLock(async () => {
      if (isLocalContextTransitioning()) return;
      await this._runSync();
    });
    try {
      await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  private async _runSync(): Promise<void> {
    this.running = true;
    setSyncRunning(true);
    const start = Date.now();
    this.emit({ type: "start" });
    this.setSyncStore({ status: "syncing", lastError: null });

    try {
      const token = useAuthStore.getState().token;
      if (!token) throw new SyncAuthError();
      const rawSucursalId =
        useSyncStore.getState().sucursalId ??
        useAuthStore.getState().sucursalActivaId;
      if (!rawSucursalId) throw new SyncAuthError("No hay sucursal activa");
      const sucursalId = canonicalSyncId(rawSucursalId);
      const role = useAuthStore.getState().user?.rol;
      const pullCursorScope = role === "facturacion"
        ? `${sucursalId}:billing`
        : sucursalId;

      const manifest = await this.deps.api!.manifest();
      this.emit({ type: "manifest", serverTime: manifest.serverTime });
      if (manifest.syncSchemaVersion !== SYNC_SCHEMA_VERSION) {
        throw new SyncSchemaMismatchError(
          manifest.syncSchemaVersion,
          SYNC_SCHEMA_VERSION,
        );
      }
      if (manifest.apiContractVersion !== API_VERSION) {
        throw new ApiContractMismatchError(
          manifest.apiContractVersion,
          API_VERSION,
        );
      }

      if (manifest.operationContract !== SYNC_OPERATION_CONTRACT) {
        throw new Error(`API does not support ${SYNC_OPERATION_CONTRACT}`);
      }
      let cursors = await this.deps.getLastPullAt(pullCursorScope);
      let totalReceived = 0;
      let hasMore = true;

      while (hasMore) {
        const pullResp = await this.deps.api!.pull({ since: cursors, sucursalId });
        await this.applyPull(pullResp.changes, sucursalId);
        totalReceived += pullResp.changes.length;
        hasMore = pullResp.hasMore;
        const nextCursors = validatePullCursors(pullResp.cursors, sucursalId);
        if (hasMore && !Object.entries(nextCursors).some(([entity, cursor]) => cursors?.[entity as SyncableEntity] !== cursor)) {
          throw new Error("INVALID_SYNC_PULL_PAGINATION");
        }
        // Cada entidad avanza su propio cursor; las sin cambios conservan el suyo.
        cursors = { ...(cursors ?? {}), ...nextCursors };
      }

      await this.deps.setLastPullAt(pullCursorScope, cursors ?? {});
      this.emit({ type: "pull", received: totalReceived });

      const pushSummary = await this.pushPending(sucursalId);
      this.emit({ type: "push", ...pushSummary });

      const remaining = (await this.deps.queue.listAll(sucursalId)).filter((item) => item.status !== "applied");
      this.setSyncStore({
        status: remaining.length ? "error" : "idle",
        ...(remaining.length ? { lastError: `Sync unresolved: ${remaining.length} operation(s)` } : { lastSyncAt: new Date().toISOString() }),
        pendingChanges: remaining.length,
      });
      this.emit({ type: "done", durationMs: Date.now() - start });
    } catch (err) {
      const syncErr =
        err instanceof HttpError && err.status === 401
          ? new SyncAuthError("Sesión expirada. Inicia sesión de nuevo.")
          : err;
      const msg = syncErr instanceof Error ? syncErr.message : String(syncErr);
      this.setSyncStore({ status: "error", lastError: msg });
      this.emit({ type: "error", error: msg });
      throw syncErr;
    } finally {
      this.running = false;
      setSyncRunning(false);
    }
  }

  private async applyPull(
    changes: SyncPullChange[],
    sucursalId: string,
  ): Promise<void> {
    if (changes.length === 0) return;
    const db = this.deps.db;
    const tables = Object.values(ENTITY_TO_TABLE).map((name) => db.table(name));
    await db.transaction("rw", [...tables, db.sync_queue], async () => {
      markRemoteTransaction();
      const identities = await localIdentities(db);
      const queued = await this.deps.queue.listAll(sucursalId);
      for (const change of changes) {
        validatePullChange(change, sucursalId);
        const table = db.table(ENTITY_TO_TABLE[change.entity]);
        const id = identities.get(table.name)?.get(canonicalSyncId(change.id)) ?? canonicalSyncId(change.id);
        const existing = await table.get(id) as Record<string, unknown> | undefined;
        if (typeof existing?.sucursal_id === "string" && canonicalSyncId(existing.sucursal_id) !== canonicalSyncId(sucursalId)) {
          throw new Error("SYNC_BRANCH_MISMATCH");
        }
        const dirty = queued.filter((item) => item.entity === change.entity && canonicalSyncId(item.entityId) === canonicalSyncId(change.id) && item.status !== "applied");
        if (dirty.length) {
          // Persist remote evidence in the same transaction as the cursor's
          // data application; never replace the user's pending clinical data.
          for (const item of dirty) {
            await db.sync_queue.update(item.id, {
              serverPayload: change.payload as Record<string, unknown> | null,
              serverRowVersion: change.serverRowVersion,
              serverDeleted: change.op === "delete",
            });
          }
          continue;
        }
        const localPayload = toLocalPayload(
          change.entity,
          (change.payload ?? { id }) as Record<string, unknown>,
        );
        const scopedPayload = bindLocalIdentities(
          withSucursalScope(localPayload, sucursalId),
          table.name,
          identities,
        );
        const row = change.partial
          ? projectPartialConsultationRow(scopedPayload, existing, change, sucursalId)
          : scopedPayload;
        if (!row) continue;
        const next: Record<string, unknown> = { ...existing, ...row, id,
          row_version: change.serverRowVersion,
          ...(change.op === "delete" ? { deleted_at: change.serverUpdatedAt, updated_at: change.serverUpdatedAt } : {}),
        };
        delete next._syncNeverSynced;
        await table.put(next);
        identities.get(table.name)!.set(canonicalSyncId(id), id);
      }
    });
  }

  private async pushPending(sucursalId: string): Promise<{
    sent: number;
    applied: number;
    conflicts: number;
    errors: number;
  }> {
    // Invalid legacy identities are evidence, not disposable queue noise.
    await this.deps.queue.quarantineMalformed(sucursalId);

    // Items atascados en syncing (tab cerrado a mitad de un push) vuelven
    // a pending para reintentarse en este ciclo.
    await this.deps.queue.requeueStaleSyncing(sucursalId);

    const db = this.deps.db;
    const batch = await db.transaction("rw", db.sync_queue, async () => {
      const all = (await this.deps.queue.listAll(sucursalId)).filter((item) => item.status !== "applied");
      const ready = new Set((await this.deps.queue.listPending(sucursalId)).map((item) => item.id));
      const queuedIds = new Set(all.map((item) => item.id));
      const seen = new Set<string>();
      const selected: SyncQueueItem[] = [];
      all.sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt) || a.id.localeCompare(b.id));
      for (const item of all) {
        const key = `${item.entity}:${canonicalSyncId(item.entityId)}`;
        if (item.predecessorId && queuedIds.has(item.predecessorId)) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!ready.has(item.id)) continue;
        const payload = parsePayload(item) as Record<string, unknown> | null;
        // A child waits for parent creates/updates. A parent tombstone cannot
        // block the child's final live revision, which may precede its delete.
        const parentIds = [payload?.patient_id, payload?.consultation_id]
          .filter((id): id is string => typeof id === "string")
          .map(canonicalSyncId);
        if (item.op !== "delete" && all.some((parent) => parent.op !== "delete" &&
          parentIds.includes(canonicalSyncId(parent.entityId)) &&
          (parent.entity === "pacientes" || parent.entity === "consultas"))) continue;
        selected.push(item);
      }
      const rank: Record<SyncableEntity, number> = { pacientes: 0, consultas: 1, antropometrias: 2, lab_panels: 2, planes_alimenticios: 3, adherence_records: 3 };
      selected.sort((a, b) => (a.op === "delete" ? -rank[a.entity] : rank[a.entity]) - (b.op === "delete" ? -rank[b.entity] : rank[b.entity]));
      const claimed = selected.slice(0, PUSH_MAX_BATCH);
      for (const item of claimed) await this.deps.queue.markSyncing(item.id);
      return claimed;
    });
    if (batch.length === 0) {
      return { sent: 0, applied: 0, conflicts: 0, errors: 0 };
    }
    let applied = 0;
    let conflicts = 0;
    let errors = 0;

    let response;
    try {
      const operations: SyncPushOperation[] = batch.map((item) => ({
        operationId: item.id,
        restoreDeleted: item.restoreDeleted === true,
        entity: item.entity,
        id: item.entityId,
        op: item.op,
        payload: toApiPayload(item.entity, parsePayload(item)),
        clientUpdatedAt: item.enqueuedAt,
        expectedRowVersion: item.expectedRowVersion ?? undefined,
      }));
      response = await withRetry(
        () => this.deps.api!.push({ sucursalId, operations }),
        {
          maxAttempts: MAX_PUSH_RETRIES,
          shouldRetry: (err) => isTransient(err),
          // sin sleep custom: backoff exponencial real (1s, 2s, 4s + jitter)
          sleep: this.deps.retrySleep,
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const item of batch) {
        await this.deps.queue.markError(item.id, message);
      }
      throw error;
    }

    let resultsByOperation: Map<string, SyncPushResultItem>;
    try {
      resultsByOperation = validatePushResults(batch, response.results);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const item of batch) await this.deps.queue.markError(item.id, message);
      throw error;
    }

    for (let i = 0; i < batch.length; i++) {
      const item = batch[i]!;
      const result = resultsByOperation.get(item.id)!;
      if (result.status === "applied") {
        if (!result.serverRowVersion) {
          await this.deps.queue.markError(item.id, "ACK_MISSING_ROW_VERSION");
          errors++;
          continue;
        }
        await db.transaction("rw", [...Object.values(ENTITY_TO_TABLE).map((name) => db.table(name)), db.sync_queue], async () => {
          markRemoteTransaction();
          const identities = await localIdentities(db);
          const table = db.table(ENTITY_TO_TABLE[item.entity]);
           const row = await table.get(item.entityId);
           const liveItem = await db.sync_queue.get(item.id);
           if (!liveItem) throw new Error("Acknowledged operation is missing locally");
            if (typeof row?.sucursal_id === "string" && canonicalSyncId(row.sucursal_id) !== canonicalSyncId(item.sucursalId)) throw new Error("SYNC_BRANCH_MISMATCH");
            const all = await this.deps.queue.listAll(sucursalId);
           const successors = all.filter((next) => next.predecessorId === item.id);
           const otherDirty = all.some((next) => next.id !== item.id && next.entity === item.entity && canonicalSyncId(next.entityId) === canonicalSyncId(item.entityId) && next.status !== "applied");
           const newerShadow = liveItem.serverRowVersion && result.serverRowVersion && compareRowVersions(liveItem.serverRowVersion, result.serverRowVersion) > 0;
           const canonical = newerShadow ? liveItem.serverPayload : result.serverPayload;
          if (row) {
            const acknowledgedRow = { ...row,
            ...(!otherDirty && canonical ? bindLocalIdentities(toLocalPayload(item.entity, canonical), table.name, identities) : {}),
            id: item.entityId, sucursal_id: item.sucursalId,
            row_version: newerShadow ? liveItem.serverRowVersion : result.serverRowVersion,
            ...(!otherDirty && (newerShadow ? liveItem.serverDeleted : result.serverDeleted) ? { deleted_at: canonical?.deleted_at ?? result.serverUpdatedAt ?? new Date().toISOString() } : {}),
            };
            delete acknowledgedRow._syncNeverSynced;
            await table.put(acknowledgedRow);
          }
           for (const next of successors) {
             if (next.attempted) throw new Error("Successor was sent before predecessor acknowledgement");
             await db.sync_queue.update(next.id, newerShadow ? {
               predecessorId: undefined,
               status: "conflict",
               lastError: "REMOTE_CHANGE_AFTER_PREDECESSOR_COMMIT_REQUIRES_REVIEW",
               serverPayload: liveItem.serverPayload,
               serverRowVersion: liveItem.serverRowVersion,
               serverDeleted: liveItem.serverDeleted,
               updatedAt: new Date().toISOString(),
             } : { expectedRowVersion: result.serverRowVersion });
           }
           await this.deps.queue.removeAfterAcknowledgement(item.id);
        });
        applied++;
      } else if (result.status === "conflict") {
        await this.deps.queue.markConflict(
          item.id,
          result.error ?? "row_version mismatch",
          {
            serverPayload: result.serverPayload,
            serverRowVersion: result.serverRowVersion,
            serverDeleted: result.serverDeleted,
          },
        );
        conflicts++;
      } else if (result.status === "skipped") {
        await this.deps.queue.markError(item.id, "Unverified skipped operation");
        errors++;
      } else {
        await this.deps.queue.markError(
          item.id,
          result.error ?? "unknown error",
        );
        errors++;
      }
    }

    await this.deps.queue.clearApplied(sucursalId);
    return { sent: batch.length, applied, conflicts, errors };
  }

  private setSyncStore(
    partial: Partial<{
      status: "idle" | "syncing" | "offline" | "error";
      lastSyncAt: string;
      pendingChanges: number;
      lastError: string | null;
    }>,
  ): void {
    const s = useSyncStore.getState();
    if (partial.status !== undefined) s.setStatus(partial.status);
    if (partial.lastSyncAt !== undefined) s.setLastSync(partial.lastSyncAt);
    if (partial.pendingChanges !== undefined)
      s.setPendingChanges(partial.pendingChanges);
    if (partial.lastError !== undefined) s.setLastError(partial.lastError);
  }

  private emit(event: SyncEvent): void {
    this.deps.onProgress?.(event);
  }
}

function projectPartialConsultationRow(
  payload: Record<string, unknown>,
  existing: Record<string, unknown> | undefined,
  change: SyncPullChange,
  sucursalId: string,
): Record<string, unknown> | null {
  if (change.entity !== "consultas") return existing ? payload : null;
  if (change.op === "delete" && !existing) return null;

  const safeFields = [
    "id",
    "sucursal_id",
    "patient_id",
    "consultation_date",
    "consultation_number",
    "status",
    "cost",
    "paid",
    "payment_status",
    "payment_concept",
    "payment_method",
    "paid_at",
    "reference",
    "invoice_number",
    "billing_notes",
    "amount_paid",
    "created_at",
    "updated_at",
    "deleted_at",
  ] as const;
  const result: Record<string, unknown> = {};
  for (const field of safeFields) {
    if (field in payload) result[field] = payload[field];
  }

  if (existing) return result;

  const required = [
    "patient_id",
    "consultation_date",
    "consultation_number",
    "status",
  ] as const;
  if (!required.every((field) => field in result)) return null;

  return {
    id: result.id,
    sucursal_id: sucursalId,
    patient_id: result.patient_id,
    consultation_date: result.consultation_date,
    consultation_number: result.consultation_number,
    reason: "",
    subjective: null,
    objective: null,
    vitals_json: null,
    assessment: null,
    plan: null,
    anthropometry_id: null,
    lab_panel_id: null,
    next_visit_date: null,
    status: result.status,
    cost: typeof result.cost === "number" ? result.cost : 0,
    paid: result.paid === true,
    payment_status: result.payment_status ?? null,
    payment_concept: result.payment_concept ?? null,
    payment_method: result.payment_method ?? null,
    paid_at: result.paid_at ?? null,
    reference: result.reference ?? null,
    invoice_number: result.invoice_number ?? null,
    billing_notes: result.billing_notes ?? null,
    amount_paid: typeof result.amount_paid === "number" ? result.amount_paid : null,
    created_at: result.created_at ?? change.serverUpdatedAt,
    updated_at: result.updated_at ?? change.serverUpdatedAt,
    deleted_at: result.deleted_at ?? null,
  };
}

function parsePayload(item: SyncQueueItem): unknown {
  if (item.op === "delete") return null;
  const payload: unknown = JSON.parse(item.payload);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid durable sync payload");
  return payload;
}

function isTransient(err: unknown): boolean {
  if (err instanceof NetworkError) return true;
  if (err instanceof HttpError) return err.status >= 500;
  return false;
}

function validatePushResults(
  batch: SyncQueueItem[],
  results: SyncPushResultItem[],
): Map<string, SyncPushResultItem> {
  if (results.length !== batch.length) throw new Error("INVALID_SYNC_RECEIPT_CARDINALITY");
  const expected = new Map(batch.map((item) => [item.id, item]));
  const mapped = new Map<string, SyncPushResultItem>();
  for (const result of results) {
    if (!result.operationId || mapped.has(result.operationId)) throw new Error("INVALID_SYNC_RECEIPT_IDENTITY");
    const item = expected.get(result.operationId);
    if (!item || item.entity !== result.entity || canonicalSyncId(item.entityId) !== canonicalSyncId(result.id)) {
      throw new Error("INVALID_SYNC_RECEIPT_IDENTITY");
    }
    if (!["applied", "conflict", "error", "skipped"].includes(result.status) ||
      (result.serverRowVersion !== undefined && !decodeRowVersion(result.serverRowVersion)) ||
      (result.status === "applied" && !decodeRowVersion(result.serverRowVersion)) ||
      (result.serverPayload !== undefined && result.serverPayload !== null &&
        (typeof result.serverPayload !== "object" || Array.isArray(result.serverPayload)))) {
      throw new Error("INVALID_SYNC_RECEIPT_PAYLOAD");
    }
    mapped.set(result.operationId, result);
  }
  if (mapped.size !== expected.size) throw new Error("INVALID_SYNC_RECEIPT_CARDINALITY");
  return mapped;
}

function compareRowVersions(left: string, right: string): number {
  const a = decodeRowVersion(left);
  const b = decodeRowVersion(right);
  if (!a || !b) return 0;
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) return a[index]! - b[index]!;
  }
  return 0;
}

function decodeRowVersion(value: unknown): Uint8Array | null {
  if (!isSyncRowVersion(value)) return null;
  try {
    const decoded = Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
    return decoded.length === ROW_VERSION_BYTES ? decoded : null;
  } catch {
    return null;
  }
}

function validatePullChange(change: SyncPullChange, sucursalId: string): void {
  if (!SYNCABLE_ENTITIES.includes(change.entity) || !change.id ||
    !["create", "update", "delete"].includes(change.op) ||
    !decodeRowVersion(change.serverRowVersion) ||
    Number.isNaN(Date.parse(change.serverUpdatedAt)) ||
    (change.partial !== undefined && typeof change.partial !== "boolean") ||
    (change.op !== "delete" && change.payload === null) ||
    (change.payload !== null && (typeof change.payload !== "object" || Array.isArray(change.payload)))) {
    throw new Error("INVALID_SYNC_PULL_CHANGE");
  }
  if (change.payload && typeof change.payload === "object") {
    const payload = change.payload as Record<string, unknown>;
    if (typeof payload.id === "string" && canonicalSyncId(payload.id) !== canonicalSyncId(change.id)) {
      throw new Error("INVALID_SYNC_PULL_IDENTITY");
    }
    if (typeof payload.sucursal_id === "string" && canonicalSyncId(payload.sucursal_id) !== canonicalSyncId(sucursalId)) {
      throw new Error("SYNC_BRANCH_MISMATCH");
    }
  }
}

function validatePullCursors(cursors: SyncPullCursors, sucursalId: string): SyncPullCursors {
  if (!cursors || typeof cursors !== "object" || Array.isArray(cursors)) {
    throw new Error("INVALID_SYNC_PULL_CURSOR");
  }
  for (const [entity, cursor] of Object.entries(cursors)) {
    if (!SYNCABLE_ENTITIES.includes(entity as SyncableEntity) || typeof cursor !== "string") {
      throw new Error("INVALID_SYNC_PULL_CURSOR");
    }
    const match = /^rv1:(.+):(pacientes|consultas|antropometrias|lab_panels|planes_alimenticios|adherence_records):([0-9a-f]{16})$/i.exec(cursor);
    if (!match || canonicalSyncId(match[1]!) !== canonicalSyncId(sucursalId) || match[2] !== entity) {
      throw new Error("INVALID_SYNC_PULL_CURSOR");
    }
  }
  return cursors;
}

export const __test = { ENTITY_TO_TABLE, ENTITY_LIST: [...SYNCABLE_ENTITIES] };
export type { SyncOp };
