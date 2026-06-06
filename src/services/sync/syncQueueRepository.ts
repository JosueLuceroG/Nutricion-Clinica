/**
 * Repositorio de la cola de sync (Dexie sync_queue).
 *
 * Enqueue se hace al detectar mutaciones; el SyncEngine lee los pending
 * en push. Items en 'conflict' se preservan hasta resolución manual.
 */

import type { Table } from 'dexie';
import type { SyncQueueItem, SyncItemStatus, SyncOp } from '@modules/sync/domain/SyncQueueItem';
import type { SyncableEntity } from '@nutriclinica/shared';

export interface EnqueueInput {
  entity: SyncableEntity;
  entityId: string;
  op: SyncOp;
  payload: unknown;
  expectedRowVersion?: string | null;
}

function buildItem(input: EnqueueInput): SyncQueueItem {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    entity: input.entity,
    entityId: input.entityId,
    op: input.op,
    payload: JSON.stringify(input.payload),
    status: 'pending',
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
  enqueueInTransaction(input: EnqueueInput, transaction: { table: (name: string) => Table<SyncQueueItem, string> }): SyncQueueItem {
    const item = buildItem(input);
    void transaction.table('sync_queue').add(item);
    return item;
  }

  async listByStatus(status: SyncItemStatus): Promise<SyncQueueItem[]> {
    return this.table.where('status').equals(status).toArray();
  }

  async listAll(): Promise<SyncQueueItem[]> {
    return this.table.toArray();
  }

  async listPending(): Promise<SyncQueueItem[]> {
    return this.table.where('status').anyOf(['pending', 'error']).toArray();
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
    entity: SyncableEntity,
    entityId: string,
    op?: SyncOp,
  ): Promise<SyncQueueItem | undefined> {
    const all = await this.table
      .where('status')
      .anyOf(['pending', 'syncing'])
      .toArray();
    return all.find(
      (i) => i.entity === entity && i.entityId === entityId && (op === undefined || i.op === op),
    );
  }

  async countPending(): Promise<number> {
    return this.table.where('status').anyOf(['pending', 'error']).count();
  }

  async countConflicts(): Promise<number> {
    return this.table.where('status').equals('conflict').count();
  }

  async markSyncing(id: string): Promise<void> {
    await this.table.update(id, { status: 'syncing', updatedAt: new Date().toISOString() });
  }

  async markApplied(id: string): Promise<void> {
    await this.table.update(id, { status: 'applied', lastError: null, updatedAt: new Date().toISOString() });
  }

  async markError(id: string, err: string): Promise<void> {
    const current = await this.table.get(id);
    if (!current) return;
    await this.table.update(id, {
      status: 'error',
      lastError: err,
      retryCount: current.retryCount + 1,
      updatedAt: new Date().toISOString(),
    });
  }

  async markConflict(id: string, err: string): Promise<void> {
    await this.table.update(id, { status: 'conflict', lastError: err, updatedAt: new Date().toISOString() });
  }

  async resolveConflict(id: string, resolution: 'local' | 'remote'): Promise<void> {
    if (resolution === 'local') {
      await this.table.update(id, { status: 'pending', lastError: null, updatedAt: new Date().toISOString() });
    } else {
      await this.table.update(id, { status: 'applied', lastError: null, updatedAt: new Date().toISOString() });
    }
  }

  async remove(id: string): Promise<void> {
    await this.table.delete(id);
  }

  async clearApplied(): Promise<number> {
    return this.table.where('status').equals('applied').delete();
  }
}
