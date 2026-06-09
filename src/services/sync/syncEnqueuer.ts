/**
 * SyncEnqueuer: registra hooks en cada tabla sincronizable para encolar
 * mutaciones en sync_queue.
 *
 * Estrategia:
 *  - En `start()` se llama `table.hook('creating'|'updating'|'deleting')` para
 *    cada tabla sincronizable. Dexie 4.x ejecuta estos hooks antes/después
 *    de cada commit.
 *  - Si la mutación viene del SyncEngine (round-trip), se ignora via el
 *    sentinel `__syncApplying` que el engine setea durante la transacción.
 *  - `stop()` no expone unsubscribe de hooks (Dexie no lo soporta), por lo
 *    que la bandera se chequea en cada hook; cuando el componente se
 *    desmonta, simplemente dejamos de encolar (no quedan referencias
 *    circulares porque queue es un repositorio Dexie vivo, no un closure).
 */

import type { NutriClinicaDB } from '@services/db/dexieSchema';
import { type SyncQueueRepository } from './syncQueueRepository.js';
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
   
  var __syncApplying: boolean | undefined;
}

export function setSyncApplying(value: boolean): void {
  globalThis.__syncApplying = value;
}

export function isSyncApplying(): boolean {
  return globalThis.__syncApplying === true;
}

interface HookableTable {
  hook: (
    event: 'creating' | 'updating' | 'deleting',
    subscriber: (primKey: unknown, obj: unknown) => void,
  ) => void;
}

export class SyncEnqueuer {
  private active = false;

  constructor(
    private readonly db: NutriClinicaDB,
    private readonly queue: SyncQueueRepository,
  ) {}

  start(): void {
    if (this.active) return;
    this.active = true;

    for (const [tableName, entity] of Object.entries(TABLE_TO_ENTITY)) {
      const table = (this.db as unknown as Record<string, HookableTable>)[tableName];
      if (!table) {
        console.warn(`[sync] table ${tableName} not found, skipping enqueuer`);
        continue;
      }
      // Los hooks de Dexie 4.x tienen diferente orden de parámetros:
      // - creating(primKey, obj) / deleting(primKey, obj)
      // - updating(modifications, primKey, obj, transaction)
      // Por eso necesitamos callbacks separados para cada hook.
      const enqueueCreate = (primKey: unknown, obj: unknown) => {
        if (!this.active || isSyncApplying()) return;
        const id = String(primKey);
        doEnqueue(this.queue, entity, id, 'create', obj);
      };
      const enqueueUpdate = (_modifications: unknown, primKey: unknown, obj: unknown) => {
        if (!this.active || isSyncApplying()) return;
        const id = String(primKey);
        doEnqueue(this.queue, entity, id, 'update', obj);
      };
      const enqueueDelete = (primKey: unknown) => {
        if (!this.active || isSyncApplying()) return;
        const id = String(primKey);
        doEnqueue(this.queue, entity, id, 'delete', null);
      };
      table.hook('creating', enqueueCreate);
      table.hook('updating', enqueueUpdate as unknown as (primKey: unknown, obj: unknown) => void);
      table.hook('deleting', enqueueDelete);
    }
  }

  stop(): void {
    this.active = false;
  }
}

function doEnqueue(
  queue: SyncQueueRepository,
  entity: SyncableEntity,
  id: string,
  op: SyncOp,
  payload: unknown,
): void {
  // La transacción del hook sólo contiene la tabla mutada
  // (e.g. `patients`); `sync_queue` no está en su scope, por lo
  // que encolar dentro del hook tira NotFoundError. Diferimos
  // el enqueue dos microtasks más allá: para entonces la
  // transacción ya hizo commit y podemos abrir una nueva sobre
  // `sync_queue` sin chocar.
  queueMicrotask(() => {
    queueMicrotask(() => {
      // Deduplicación: si ya hay un item activo (pending/syncing)
      // para esta misma (entity, entityId, op), no encolamos otro.
      // Protege contra múltiples instancias del enqueuer enganchadas
      // a la misma tabla (HMR de Vite + React StrictMode en dev).
      queue
        .findActiveByEntityId(entity, id, op)
        .then((existing) => {
          if (existing) return;
          return queue.enqueue({ entity, entityId: id, op, payload });
        })
        .catch((err: unknown) => {
          console.error('[sync] enqueue failed', err);
        });
    });
  });
}
