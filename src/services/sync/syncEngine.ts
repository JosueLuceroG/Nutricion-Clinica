/**
 * SyncEngine: orquesta pull + push entre Dexie local y el backend.
 *
 * Flujo por ciclo (sync()):
 *   1. Si no hay token \u2192 noop (usuario no autenticado).
 *   2. GET /sync/manifest \u2192 valida SYNC_SCHEMA_VERSION.
 *   3. Pull: GET /sync/pull?since=<lastPullAt>; aplica cada cambio a la tabla
 *      correspondiente con setSyncApplying(true) para no re-encolar.
 *   4. Push: lee sync_queue donde status IN (pending, error), arma el batch,
 *      POST /sync/push; actualiza status seg\u00fan resultado.
 *   5. Actualiza syncStore (status, lastSyncAt, pendingChanges).
 *
 * Reintentos: el push se envuelve en withRetry. Network/auth/schema-mismatch
 * son las 3 clases de error que el engine sabe distinguir.
 */

import type { NutriClinicaDB } from '@services/db/dexieSchema';
import type { SyncQueueItem, SyncOp } from '@modules/sync/domain/SyncQueueItem';
import { SYNCABLE_ENTITIES, type SyncableEntity } from '@nutriclinica/shared';
import type { SyncPullChange, SyncPushOperation, SyncPushResultItem } from '@nutriclinica/shared';
import { SYNC_SCHEMA_VERSION } from '@nutriclinica/shared';
import { type SyncQueueRepository } from './syncQueueRepository.js';
import { setSyncApplying } from './syncEnqueuer.js';
import { type syncApi } from './syncApiClient.js';
import { withRetry } from './backoff.js';
import { useAuthStore } from '@store/authStore';
import { useSyncStore } from '@store/syncStore';
import { withCurrentSucursalScope } from '@services/tenancy/sucursalScope';
import { SyncAuthError, SyncSchemaMismatchError } from '@modules/sync/domain/errors.js';
import { HttpError, NetworkError } from '../api/httpClient.js';

const PUSH_MAX_BATCH = 500;
const MAX_PUSH_RETRIES = 4;

const ENTITY_TO_TABLE: Record<SyncableEntity, keyof NutriClinicaDB & string> = {
  pacientes: 'patients',
  consultas: 'consultations',
  antropometrias: 'anthropometry',
  lab_panels: 'lab_panels',
  planes_alimenticios: 'meal_plans',
  adherence_records: 'adherence_records',
};

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
const PULL_JSON_COLUMNS: Record<string, Array<{ serverKey: string; localKey: string }>> = {
  consultas: [{ serverKey: 'vitals', localKey: 'vitals_json' }],
  planes_alimenticios: [{ serverKey: 'meals', localKey: 'meals_json' }],
  pacientes: [{ serverKey: 'clinical_tags', localKey: 'clinical_tags' }],
  // lab_panels: { results } ya se almacena como array, el mapper LabPanelRow
  // lee `row.results` directamente sin JSON.parse → correcto.
};

function toLocalRow(entity: SyncableEntity, payload: Record<string, unknown>): object {
  const jsonCols = PULL_JSON_COLUMNS[entity];
  if (!jsonCols) return payload;
  const row = { ...payload };
  for (const { serverKey, localKey } of jsonCols) {
    if (!(serverKey in row)) continue;
    const val = row[serverKey];
    row[localKey] = val !== null && val !== undefined ? JSON.stringify(val) : null;
    if (serverKey !== localKey) delete row[serverKey];
  }
  return row;
}

export interface SyncEngineDeps {
  db: NutriClinicaDB;
  queue: SyncQueueRepository;
  /** Devuelve el lastPullAt persistido (puede ser null la primera vez). */
  getLastPullAt: (sucursalId: string) => string | null | Promise<string | null>;
  setLastPullAt: (sucursalId: string, iso: string) => void | Promise<void>;
  /** Caller puede sobreescribir el cliente HTTP (test). */
  api?: typeof syncApi;
  /** Hook opcional para notificar al UI. */
  onProgress?: (event: SyncEvent) => void;
}

export type SyncEvent =
  | { type: 'start' }
  | { type: 'manifest'; serverTime: string }
  | { type: 'pull'; received: number }
  | { type: 'push'; sent: number; applied: number; conflicts: number; errors: number }
  | { type: 'done'; durationMs: number }
  | { type: 'error'; error: string };

export class SyncEngine {
  private running = false;
  private inFlight: Promise<void> | null = null;

  constructor(private readonly deps: SyncEngineDeps) {}

  isRunning(): boolean {
    return this.running;
  }

  async sync(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this._runSync();
    try { await this.inFlight; } finally { this.inFlight = null; }
  }

  private async _runSync(): Promise<void> {
    this.running = true;
    const start = Date.now();
    this.emit({ type: 'start' });
    this.setSyncStore({ status: 'syncing', lastError: null });

    try {
      const token = useAuthStore.getState().token;
      if (!token) throw new SyncAuthError();

      const manifest = await this.deps.api!.manifest();
      this.emit({ type: 'manifest', serverTime: manifest.serverTime });
      if (manifest.syncSchemaVersion !== SYNC_SCHEMA_VERSION) {
        throw new SyncSchemaMismatchError(manifest.syncSchemaVersion, SYNC_SCHEMA_VERSION);
      }

      const sucursalId = useSyncStore.getState().sucursalId ?? useAuthStore.getState().sucursalActivaId;
      if (!sucursalId) throw new SyncAuthError('No hay sucursal activa');

      let since = await this.deps.getLastPullAt(sucursalId);
      let totalReceived = 0;
      let hasMore = true;

      while (hasMore) {
        const pullResp = await this.deps.api!.pull({ since, sucursalId });
        await this.applyPull(pullResp.changes);
        totalReceived += pullResp.changes.length;
        hasMore = pullResp.hasMore;
        since = pullResp.nextSince;
      }

      await this.deps.setLastPullAt(sucursalId, since ?? new Date().toISOString());
      this.emit({ type: 'pull', received: totalReceived });

      const pushSummary = await this.pushPending(sucursalId);
      this.emit({ type: 'push', ...pushSummary });

      this.setSyncStore({
        status: 'idle',
        lastSyncAt: new Date().toISOString(),
        pendingChanges: await this.deps.queue.countPending(),
      });
      this.emit({ type: 'done', durationMs: Date.now() - start });
    } catch (err) {
      const syncErr = err instanceof HttpError && err.status === 401
        ? new SyncAuthError('Sesión expirada. Inicia sesión de nuevo.')
        : err;
      const msg = syncErr instanceof Error ? syncErr.message : String(syncErr);
      this.setSyncStore({ status: 'error', lastError: msg });
      this.emit({ type: 'error', error: msg });
      throw syncErr;
    } finally {
      this.running = false;
    }
  }

  private async applyPull(changes: SyncPullChange[]): Promise<void> {
    if (changes.length === 0) return;
    setSyncApplying(true);
    try {
      for (const change of changes) {
        const tableName = ENTITY_TO_TABLE[change.entity];
        const table = (this.deps.db as unknown as Record<string, {
          put: (v: unknown) => Promise<unknown>;
          update: (k: string, patch: object) => Promise<unknown>;
          get: (k: string) => Promise<unknown>;
        }>)[tableName];
        if (!table) continue;
        if (change.op === 'delete') {
          // Soft-delete local en vez de hard-delete: preservamos la fila con
          // `deleted_at` setteado para que la UI pueda mostrarla en una vista
          // de "papelera" y permitir restaurarla. El server ya hizo el mismo
          // soft-delete (ver syncService.applyOperation), así que la fila es
          // recuperable en ambos lados.
          //
          // Si la fila no existe localmente (caso normal: server borró algo
          // que nunca existió en este cliente), no hacemos nada — el delete
          // ya es idempotente.
          const existing = await table.get(change.id).catch(() => null);
          if (existing) {
            await table.update(change.id, {
              deleted_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        } else {
          const localRow = withCurrentSucursalScope(toLocalRow(change.entity, change.payload as Record<string, unknown>));
          await table.put(localRow);
        }
      }
    } finally {
      setSyncApplying(false);
    }
  }

  private async pushPending(sucursalId: string): Promise<{ sent: number; applied: number; conflicts: number; errors: number }> {
    // Limpieza automática de items con entityId malformado ([object)
    // que quedaron de versiones anteriores del enqueuer.
    await this.deps.queue.clearStale();

    const pending = await this.deps.queue.listPending();
    if (pending.length === 0) {
      return { sent: 0, applied: 0, conflicts: 0, errors: 0 };
    }
    const batch = pending.slice(0, PUSH_MAX_BATCH);
    let applied = 0;
    let conflicts = 0;
    let errors = 0;

    const operations: SyncPushOperation[] = batch.map((item) => ({
      entity: item.entity,
      id: item.entityId,
      op: item.op,
      payload: parsePayload(item),
      clientUpdatedAt: item.updatedAt,
      expectedRowVersion: item.expectedRowVersion ?? undefined,
    }));

    for (const item of batch) {
      await this.deps.queue.markSyncing(item.id);
    }

    const response = await withRetry(() => this.deps.api!.push({ sucursalId, operations }), {
      maxAttempts: MAX_PUSH_RETRIES,
      shouldRetry: (err) => isTransient(err),
      sleep: () => Promise.resolve(),
    });

    for (let i = 0; i < batch.length; i++) {
      const item = batch[i]!;
      const result: SyncPushResultItem | undefined = response.results[i];
      if (!result) {
        await this.deps.queue.markError(item.id, 'no result for op');
        errors++;
        continue;
      }
      if (result.status === 'applied') {
        await this.deps.queue.markApplied(item.id);
        applied++;
      } else if (result.status === 'conflict') {
        await this.deps.queue.markConflict(item.id, result.error ?? 'row_version mismatch');
        conflicts++;
      } else if (result.status === 'skipped') {
        // Idempotencia: si el server ya tiene la fila o no la encuentra,
        // el push es funcionalmente exitoso. Marcamos applied para limpiar
        // la cola y avanzar.
        await this.deps.queue.markApplied(item.id);
        applied++;
      } else {
        await this.deps.queue.markError(item.id, result.error ?? 'unknown error');
        errors++;
      }
    }

    await this.deps.queue.clearApplied();
    return { sent: batch.length, applied, conflicts, errors };
  }

  private setSyncStore(partial: Partial<{ status: 'idle' | 'syncing' | 'offline' | 'error'; lastSyncAt: string; pendingChanges: number; lastError: string | null }>): void {
    const s = useSyncStore.getState();
    if (partial.status !== undefined) s.setStatus(partial.status);
    if (partial.lastSyncAt !== undefined) s.setLastSync(partial.lastSyncAt);
    if (partial.pendingChanges !== undefined) s.setPendingChanges(partial.pendingChanges);
    if (partial.lastError !== undefined) s.setLastError(partial.lastError);
  }

  private emit(event: SyncEvent): void {
    this.deps.onProgress?.(event);
  }
}

function parsePayload(item: SyncQueueItem): unknown {
  if (item.op === 'delete') return null;
  try {
    return JSON.parse(item.payload);
  } catch {
    return null;
  }
}

function isTransient(err: unknown): boolean {
  if (err instanceof NetworkError) return true;
  if (err instanceof HttpError) return err.status >= 500;
  return false;
}

export const __test = { ENTITY_TO_TABLE, ENTITY_LIST: [...SYNCABLE_ENTITIES] };
export type { SyncOp };
