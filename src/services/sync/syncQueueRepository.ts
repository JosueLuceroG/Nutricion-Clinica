/**
 * Repositorio de la cola de sync (Dexie sync_queue).
 *
 * Enqueue se hace al detectar mutaciones; el SyncEngine lee los pending
 * en push. Items en 'conflict' se preservan hasta resolución manual.
 */

import type { Table } from "dexie";
import type {
  SyncQueueItem,
  SyncItemStatus,
  SyncOp,
} from "@modules/sync/domain/SyncQueueItem";
import { canonicalSyncId, isSyncRowVersion, type SyncableEntity } from "@nutriclinica/shared";
import { markRemoteTransaction, SYNC_TABLES } from "./atomicOutbox";
import { toLocalPayload } from "./syncPayloadMapping";

/** Máximo de reintentos automáticos antes de dejar el item en error estable. */
export const MAX_AUTO_RETRIES = 8;

export interface EnqueueInput {
  sucursalId: string;
  entity: SyncableEntity;
  entityId: string;
  op: SyncOp;
  payload: unknown;
  expectedRowVersion?: string | null;
}

function buildItem(input: EnqueueInput): SyncQueueItem {
  const sucursalId = input.sucursalId.trim();
  if (!sucursalId) {
    throw new Error("No se puede encolar una mutación sin sucursal");
  }
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    sucursalId: canonicalSyncId(sucursalId),
    entity: input.entity,
    entityId: input.entityId,
    op: input.op,
    payload: JSON.stringify(input.payload),
    status: "pending",
    attempted: false,
    createsEntity: input.op === "create",
    retryCount: 0,
    lastError: null,
    expectedRowVersion: input.expectedRowVersion ?? null,
    enqueuedAt: now,
    updatedAt: now,
  };
}

export class SyncQueueRepository {
  constructor(private readonly table: Table<SyncQueueItem, string>) {}

  private async listForSucursal(sucursalId: string): Promise<SyncQueueItem[]> {
    const canonical = canonicalSyncId(sucursalId);
    return this.table
      .filter((item) => canonicalSyncId(item.sucursalId) === canonical)
      .toArray();
  }

  async enqueue(input: EnqueueInput): Promise<SyncQueueItem> {
    const item = buildItem(input);
    await this.table.add(item);
    return item;
  }

  /**
   * Variante para usar dentro de un hook de Dexie: enqueue reutiliza la
   * transacción que disparó el hook en lugar de iniciar una nueva. Sin
   * esto, el `add` choca con la transacción abierta y la cola nunca
   * se llena.
   */
  enqueueInTransaction(
    input: EnqueueInput,
    transaction: { table: (name: string) => Table<SyncQueueItem, string> },
  ): SyncQueueItem {
    const item = buildItem(input);
    void transaction.table("sync_queue").add(item);
    return item;
  }

  async listByStatus(
    status: SyncItemStatus,
    sucursalId: string,
  ): Promise<SyncQueueItem[]> {
    return (await this.listForSucursal(sucursalId)).filter(
      (item) => item.status === status,
    );
  }

  async listAll(sucursalId?: string): Promise<SyncQueueItem[]> {
    if (!sucursalId) return this.table.toArray();
    return this.listForSucursal(sucursalId);
  }

  async listPending(sucursalId: string): Promise<SyncQueueItem[]> {
    const items = (await this.listForSucursal(sucursalId)).filter(
      (item) => item.status === "pending" || item.status === "error",
    );
    // Los items en error agotaron sus reintentos automáticos: se quedan
    // en la cola (visibles en el diagnóstico) pero no se re-empujan.
    return items.filter((i) => i.status === "pending" || i.retryCount < MAX_AUTO_RETRIES);
  }

  /**
   * Busca items con status activo para (entity, entityId). Si se pasa `op`,
   * filtra también por operación.
   *
   * Usado por el SyncEnqueuer para deduplicar: si ya hay un item
   * pendiente (pending/syncing) para la misma fila, no encola otro.
   * Protege contra múltiples instancias del enqueuer enganchadas a
   * la misma tabla (e.g. HMR de Vite + React StrictMode en dev).
   */
  async findActiveByEntityId(
    sucursalId: string,
    entity: SyncableEntity,
    entityId: string,
    op?: SyncOp,
  ): Promise<SyncQueueItem | undefined> {
    const all = (await this.listForSucursal(sucursalId)).filter(
      (item) => item.status === "pending" || item.status === "syncing",
    );
    return all.find(
      (i) =>
        i.entity === entity &&
        canonicalSyncId(i.entityId) === canonicalSyncId(entityId) &&
        (op === undefined || i.op === op),
    );
  }

  async replacePendingPayload(id: string, payload: unknown): Promise<void> {
    const current = await this.table.get(id);
    if (current?.status !== "pending" || current.attempted !== false) return;
    await this.table.update(id, {
      payload: JSON.stringify(payload),
      updatedAt: new Date().toISOString(),
    });
  }

  async countPending(sucursalId: string): Promise<number> {
    return (await this.listForSucursal(sucursalId)).filter(
      (item) => item.status === "pending" || item.status === "error",
    ).length;
  }

  async countConflicts(sucursalId: string): Promise<number> {
    return (await this.listForSucursal(sucursalId)).filter(
      (item) => item.status === "conflict",
    ).length;
  }

  async markSyncing(id: string): Promise<void> {
    await this.table.update(id, {
      status: "syncing",
      attempted: true,
      updatedAt: new Date().toISOString(),
    });
  }

  async markApplied(id: string): Promise<void> {
    await this.table.update(id, {
      status: "applied",
      lastError: null,
      updatedAt: new Date().toISOString(),
    });
  }

  async markError(id: string, err: string): Promise<void> {
    const current = await this.table.get(id);
    if (!current) return;
    await this.table.update(id, {
      status: "error",
      lastError: err,
      retryCount: current.retryCount + 1,
      updatedAt: new Date().toISOString(),
    });
  }

  async markConflict(
    id: string,
    err: string,
    evidence: Pick<SyncQueueItem, "serverPayload" | "serverRowVersion" | "serverDeleted"> = {},
  ): Promise<void> {
    await this.table.update(id, {
      status: "conflict",
      lastError: err,
      serverPayload: evidence.serverPayload,
      serverRowVersion: evidence.serverRowVersion,
      serverDeleted: evidence.serverDeleted,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Items atascados en `syncing` (el tab murió a mitad de un push) se
   * devuelven a `pending` para que el siguiente ciclo los reintente.
   * Sin esto, una edición local queda en la cola para siempre sin señal.
   */
  async requeueStaleSyncing(
    sucursalId: string,
    maxAgeMs = 5 * 60_000,
  ): Promise<number> {
    const now = Date.now();
    const stale = (await this.listForSucursal(sucursalId)).filter(
      (item) => item.status === "syncing",
    );
    const toRequeue = stale.filter(
      (i) => now - new Date(i.updatedAt).getTime() > maxAgeMs,
    );
    if (toRequeue.length === 0) return 0;
    for (const item of toRequeue) {
      await this.table.update(item.id, {
        status: "pending",
        attempted: true,
        updatedAt: new Date().toISOString(),
      });
    }
    return toRequeue.length;
  }

  async resolveConflict(
    id: string,
    resolution: "local" | "remote",
  ): Promise<void> {
    const db = this.table.db;
    const snapshot = await this.table.get(id);
    if (!snapshot) return;
    const tableName = Object.entries(SYNC_TABLES).find(([, entity]) => entity === snapshot.entity)![0];
    const entityTable = db.table(tableName);
    await db.transaction("rw", [entityTable, this.table], async () => {
      markRemoteTransaction();
      const item = await this.table.get(id);
      if (!item || item.status !== "conflict") throw new Error("Operation is not a conflict");
      const successors = (await this.listAll(item.sucursalId)).filter((next) => next.predecessorId === id);
      const local = await entityTable.get(item.entityId);
      if (typeof local?.sucursal_id === "string" && canonicalSyncId(local.sucursal_id) !== canonicalSyncId(item.sucursalId)) throw new Error("SYNC_BRANCH_MISMATCH");
      if (resolution === "local") {
        if (item.serverDeleted || !item.serverRowVersion) throw new Error("Remote deletion requires accepting the tombstone; automatic resurrection is prohibited");
        const newId = crypto.randomUUID();
        const now = new Date().toISOString();
        await this.table.add({ ...item, id: newId,
          op: item.op === "create" ? "update" : item.op,
          createsEntity: false,
          restoreDeleted: false,
          expectedRowVersion: item.serverRowVersion,
          status: "pending", attempted: false, retryCount: 0, lastError: null,
          serverPayload: undefined, serverRowVersion: undefined, serverDeleted: undefined,
          enqueuedAt: now, updatedAt: now,
        });
        if (local?._syncHead === id) await entityTable.put({ ...local, _syncHead: newId });
        for (const next of successors) await this.table.update(next.id, { predecessorId: newId });
      } else {
        if (item.serverPayload === undefined && !item.serverDeleted) throw new Error("Remote conflict evidence is unavailable; pull before resolving");
        if (!successors.length) {
          const remote = toLocalPayload(item.entity, item.serverPayload ?? { id: item.entityId });
          for (const key of ["patient_id", "consultation_id"] as const) {
            if (typeof local?.[key] === "string" && typeof remote[key] === "string" &&
              local[key].toLowerCase() === remote[key].toLowerCase()) remote[key] = local[key];
          }
          await entityTable.put({ ...local,
            ...remote,
            id: item.entityId, sucursal_id: canonicalSyncId(item.sucursalId),
            _syncNeverSynced: undefined,
            row_version: item.serverRowVersion ?? null,
            ...(item.serverDeleted ? { deleted_at: (item.serverPayload?.deleted_at as string | undefined) ?? new Date().toISOString() } : {}),
          });
        }
        for (const next of successors) await this.table.update(next.id, {
          predecessorId: undefined, status: "conflict", lastError: "Resolve newer local revision explicitly",
          serverPayload: item.serverPayload, serverRowVersion: item.serverRowVersion, serverDeleted: item.serverDeleted,
        });
      }
      await this.table.delete(id);
    });
  }

  async removeAfterAcknowledgement(id: string): Promise<void> {
    const item = await this.table.get(id);
    if (!item || item.status !== "syncing" || item.attempted !== true) {
      throw new Error("Only an attempted syncing operation can be acknowledged");
    }
    await this.table.delete(id);
  }

  async clearApplied(sucursalId: string): Promise<number> {
    const ids = (await this.listForSucursal(sucursalId))
      .filter((item) => item.status === "applied")
      .map((item) => item.id);
    if (ids.length > 0) await this.table.bulkDelete(ids);
    return ids.length;
  }

  async clearAll(sucursalId?: string): Promise<number> {
    const all = await this.listAll(sucursalId);
    if (all.some((item) => item.status !== "applied")) {
      throw new Error("UNRESOLVED_SYNC_OPERATIONS_CANNOT_BE_DISCARDED");
    }
    const ids = all.map((i) => i.id);
    if (ids.length === 0) return 0;
    await this.table.bulkDelete(ids);
    return ids.length;
  }

  async quarantineMalformed(sucursalId: string): Promise<number> {
    const all = await this.listAll(sucursalId);
    const stale = all.filter((item) =>
      item.entityId.startsWith("[object") ||
      (item.expectedRowVersion != null && !isSyncRowVersion(item.expectedRowVersion)),
    );
    if (stale.length === 0) return 0;
    await this.table.bulkPut(stale.map((item) => ({
      ...item,
      status: "conflict" as const,
      lastError: item.entityId.startsWith("[object")
        ? "MALFORMED_LEGACY_ENTITY_ID_REQUIRES_REVIEW"
        : "MALFORMED_ROW_VERSION_REQUIRES_REVIEW",
      updatedAt: new Date().toISOString(),
    })));
    return stale.length;
  }
}
