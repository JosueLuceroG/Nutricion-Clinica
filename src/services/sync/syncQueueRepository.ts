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
import type { SyncableEntity } from "@nutriclinica/shared";

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
  if (!input.sucursalId.trim()) {
    throw new Error("No se puede encolar una mutación sin sucursal");
  }
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    sucursalId: input.sucursalId,
    entity: input.entity,
    entityId: input.entityId,
    op: input.op,
    payload: JSON.stringify(input.payload),
    status: "pending",
    retryCount: 0,
    lastError: null,
    expectedRowVersion: input.expectedRowVersion ?? null,
    enqueuedAt: now,
    updatedAt: now,
  };
}

export class SyncQueueRepository {
  constructor(private readonly table: Table<SyncQueueItem, string>) {}

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
    return this.table
      .where("[sucursalId+status]")
      .equals([sucursalId, status])
      .toArray();
  }

  async listAll(sucursalId?: string): Promise<SyncQueueItem[]> {
    if (!sucursalId) return this.table.toArray();
    return this.table.where("sucursalId").equals(sucursalId).toArray();
  }

  async listPending(sucursalId: string): Promise<SyncQueueItem[]> {
    const items = await this.table
      .where("[sucursalId+status]")
      .anyOf([
        [sucursalId, "pending"],
        [sucursalId, "error"],
      ])
      .toArray();
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
    const all = await this.table
      .where("[sucursalId+status]")
      .anyOf([
        [sucursalId, "pending"],
        [sucursalId, "syncing"],
      ])
      .toArray();
    return all.find(
      (i) =>
        i.entity === entity &&
        i.entityId === entityId &&
        (op === undefined || i.op === op),
    );
  }

  async replacePendingPayload(id: string, payload: unknown): Promise<void> {
    const current = await this.table.get(id);
    if (current?.status !== "pending") return;
    const freshVersion =
      payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      typeof (payload as { row_version?: unknown }).row_version === "string"
        ? (payload as { row_version: string }).row_version
        : current.expectedRowVersion;
    await this.table.update(id, {
      payload: JSON.stringify(payload),
      expectedRowVersion: freshVersion,
      updatedAt: new Date().toISOString(),
    });
  }

  async countPending(sucursalId: string): Promise<number> {
    return this.table
      .where("[sucursalId+status]")
      .anyOf([
        [sucursalId, "pending"],
        [sucursalId, "error"],
      ])
      .count();
  }

  async countConflicts(sucursalId: string): Promise<number> {
    return this.table
      .where("[sucursalId+status]")
      .equals([sucursalId, "conflict"])
      .count();
  }

  async markSyncing(id: string): Promise<void> {
    await this.table.update(id, {
      status: "syncing",
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
    serverRowVersion?: string,
  ): Promise<void> {
    await this.table.update(id, {
      status: "conflict",
      lastError: err,
      expectedRowVersion: serverRowVersion ?? undefined,
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
    const stale = await this.table
      .where("[sucursalId+status]")
      .equals([sucursalId, "syncing"])
      .toArray();
    const toRequeue = stale.filter(
      (i) => now - new Date(i.updatedAt).getTime() > maxAgeMs,
    );
    if (toRequeue.length === 0) return 0;
    for (const item of toRequeue) {
      await this.table.update(item.id, {
        status: "pending",
        updatedAt: new Date().toISOString(),
      });
    }
    return toRequeue.length;
  }

  async resolveConflict(
    id: string,
    resolution: "local" | "remote",
  ): Promise<void> {
    if (resolution === "local") {
      await this.table.update(id, {
        status: "pending",
        lastError: null,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await this.table.update(id, {
        status: "applied",
        lastError: null,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  async remove(id: string): Promise<void> {
    await this.table.delete(id);
  }

  async clearApplied(sucursalId: string): Promise<number> {
    return this.table
      .where("[sucursalId+status]")
      .equals([sucursalId, "applied"])
      .delete();
  }

  async clearAll(sucursalId?: string): Promise<number> {
    const all = await this.listAll(sucursalId);
    const ids = all.map((i) => i.id);
    if (ids.length === 0) return 0;
    await this.table.bulkDelete(ids);
    return ids.length;
  }

  async clearStale(sucursalId: string): Promise<number> {
    const all = await this.listAll(sucursalId);
    const stale = all.filter((i) => i.entityId.startsWith("[object"));
    if (stale.length === 0) return 0;
    await this.table.bulkDelete(stale.map((i) => i.id));
    return stale.length;
  }
}
