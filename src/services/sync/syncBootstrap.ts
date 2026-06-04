/**
 * Bootstrap del SyncEngine: persistencia de lastPullAt + helpers de start/stop.
 *
 * - lastPullAt se guarda en localStorage (pequeño, sin necesidad de tabla).
 * - El engine se crea lazy (en el primer sync()) y se reusa entre llamadas.
 * - start() arranca el ciclo peri\u00f3dico; stop() lo cancela.
 */

import { NutriClinicaDB } from '@services/db/dexieSchema';
import { SyncQueueRepository } from './syncQueueRepository.js';
import { SyncEngine, type SyncEngineDeps, type SyncEvent } from './syncEngine.js';
import { syncApi } from './syncApiClient.js';
import { useAuthStore } from '@store/authStore';
import { useSyncStore } from '@store/syncStore';

const LAST_PULL_AT_KEY = 'nutriclinica.lastPullAt';

function getLastPullAt(): string | null {
  try {
    return localStorage.getItem(LAST_PULL_AT_KEY);
  } catch {
    return null;
  }
}

function setLastPullAt(iso: string): void {
  try {
    localStorage.setItem(LAST_PULL_AT_KEY, iso);
  } catch {
    /* ignore */
  }
}

let engineInstance: SyncEngine | null = null;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function getSyncEngine(db: NutriClinicaDB): SyncEngine {
  if (engineInstance) return engineInstance;
  const queue = new SyncQueueRepository(db.sync_queue);
  const deps: SyncEngineDeps = {
    db,
    queue,
    getLastPullAt,
    setLastPullAt,
    api: syncApi,
  };
  engineInstance = new SyncEngine(deps);
  return engineInstance;
}

export function resetSyncEngine(): void {
  engineInstance = null;
}

export interface StartOptions {
  /** Polling en ms; default 30s. 0 = solo on-demand. */
  intervalMs?: number;
  /** Sincronizar al iniciar sesi\u00f3n. */
  runOnStart?: boolean;
  /** Hook para eventos (logging, analytics). */
  onEvent?: (event: SyncEvent) => void;
}

export function startSync(db: NutriClinicaDB, options: StartOptions = {}): void {
  const engine = getSyncEngine(db);
  const { intervalMs = 30_000, runOnStart = true, onEvent } = options;

  // Cuando el usuario cambia de sucursal, refrescar.
  useAuthStore.subscribe((state) => {
    const newId = state.sucursalActivaId;
    const prevId = useSyncStore.getState().sucursalId;
    if (newId && newId !== prevId) {
      useSyncStore.getState().setSucursalId(newId);
    }
  });

  if (runOnStart && useAuthStore.getState().isAuthenticated) {
    void engine.sync();
  }

  if (intervalMs > 0 && intervalHandle === null) {
    intervalHandle = setInterval(() => {
      if (useAuthStore.getState().isAuthenticated) {
        void engine.sync();
      }
    }, intervalMs);
  }

  if (onEvent) {
    // Bridge simple: el engine no tiene onEvent p\u00fablico m\u00e1s all\u00e1 de deps.onProgress;
    // para uso real, el caller puede envolver getSyncEngine() con sus propios deps.
    void onEvent;
  }
}

export function stopSync(): void {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
