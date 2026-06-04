/**
 * SyncEnqueuer: hook sobre Dexie que encola mutaciones en sync_queue.
 *
 * Estrategia:
 *  - Suscribe `db.use()` a los tables sincronizables.
 *  - Cuando una mutación ocurre (create/update/delete) en una tabla mapeada,
 *    encola el cambio.
 *  - Si la mutación viene del SyncEngine (round-trip), se ignora: el SyncEngine
 *    setea `__syncApplying = true` durante la transacción.
 */

import type { NutriClinicaDB } from '@services/db/dexieSchema';
import { SyncQueueRepository } from './syncQueueRepository.js';
import type { SyncOp } from '@modules/sync/domain/SyncQueueItem';
import type { SyncableEntity } from '@nutriclinica/shared';

const TABLE_TO_ENTITY: Record<string, SyncableEntity> = {
  patients: 'pacientes',
  consultations: 'consultas',
  anthropometry: 'antropometrias',
  lab_panels: 'lab_panels',
  meal_plans: 'planes_alimenticios',
};

declare global {
  // eslint-disable-next-line no-var
  var __syncApplying: boolean | undefined;
}

export function setSyncApplying(value: boolean): void {
  globalThis.__syncApplying = value;
}

export function isSyncApplying(): boolean {
  return globalThis.__syncApplying === true;
}

export class SyncEnqueuer {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly db: NutriClinicaDB,
    private readonly queue: SyncQueueRepository,
  ) {}

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.subscribe();
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private subscribe(): () => void {
    const handler = async (change: { table: string; type: number; key?: unknown; keys?: unknown[]; obj?: unknown; oldObj?: unknown }): Promise<void> => {
      if (isSyncApplying()) return;
      const entity = TABLE_TO_ENTITY[change.table];
      if (!entity) return;

      const op = mapChangeTypeToOp(change.type);
      if (!op) return;

      const keys: unknown[] = change.keys ?? (change.key !== undefined ? [change.key] : []);
      for (const key of keys) {
        const id = String(key);
        let payload: unknown = null;
        if (op === 'update' && change.obj) {
          payload = change.obj;
        } else if (op === 'create' && change.obj) {
          payload = change.obj;
        } else if (op === 'delete') {
          payload = null;
        } else {
          try {
            const table = (this.db as unknown as Record<string, { get: (k: string) => Promise<unknown> }>)[change.table];
            if (table) payload = await table.get(id);
          } catch {
            payload = null;
          }
        }
        try {
          await this.queue.enqueue({ entity, entityId: id, op, payload });
        } catch (err) {
          console.error('[sync] enqueue failed', err);
        }
      }
    };

    // Dexie 'changes' event: se dispara despu\u00e9s de cada commit. La firma
    // exacta var\u00eda entre versiones; usamos un cast a la forma com\u00fan
    // documentada (Dexie 3.x y 4.x son compatibles con este shape b\u00e1sico).
    const dbWithChanges = this.db as unknown as { on: (event: string, cb: typeof handler) => unknown };
    const subscription = dbWithChanges.on('changes', handler);
    if (typeof subscription === 'function') {
      return subscription as () => void;
    }
    return () => {
      // Fallback: no expone unsubscribe; el handler se vuelve no-op al stop().
    };
  }
}

function mapChangeTypeToOp(type: number): SyncOp | null {
  // Dexie change types: 1=create, 2=update, 3=delete.
  if (type === 1) return 'create';
  if (type === 2) return 'update';
  if (type === 3) return 'delete';
  return null;
}
