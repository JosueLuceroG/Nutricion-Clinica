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

export class SyncQueueRepository {
  constructor(private readonly table: Table<SyncQueueItem, string>) {}

  async enqueue(input: EnqueueInput): Promise<SyncQueueItem> {
    const now = new Date().toISOString();
    const item: SyncQueueItem = {
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
    await this.table.add(item);
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
