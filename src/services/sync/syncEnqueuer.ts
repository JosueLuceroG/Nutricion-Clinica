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
    const tables = Object.keys(TABLE_TO_ENTITY);
    const handler = async (ctx: { table: string; mode: string; keys: unknown[] }): Promise<void> => {
      if (isSyncApplying()) return;
      const entity = TABLE_TO_ENTITY[ctx.table];
      if (!entity) return;

      const op = mapModeToOp(ctx.mode);
      if (!op) return;

      for (const key of ctx.keys) {
        const id = String(key);
        let payload: unknown = null;
        try {
          const table = (this.db as unknown as Record<string, { get: (k: string) => Promise<unknown> }>)[ctx.table];
          if (op !== 'delete' && table) {
            payload = await table.get(id);
          }
        } catch {
          payload = null;
        }
        try {
          await this.queue.enqueue({ entity, entityId: id, op, payload });
        } catch (err) {
          console.error('[sync] enqueue failed', err);
        }
      }
    };

    // Dexie `db.use()` se invoca antes de cada transacción sobre las tablas
    // observadas. Como la API de `use` no soporta filtrar por tabla en algunas
    // versiones, dejamos que se dispare para todas y filtramos en el handler.
    const subscription = this.db.use({ tables, handler });
    return () => subscription.unsubscribe();
  }
}

function mapModeToOp(mode: string): SyncOp | null {
  if (mode === 'create') return 'create';
  if (mode === 'update') return 'update';
  if (mode === 'delete') return 'delete';
  return null;
}
