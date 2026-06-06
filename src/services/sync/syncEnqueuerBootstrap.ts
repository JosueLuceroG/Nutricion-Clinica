/**
 * Bootstrap del SyncEnqueuer.
 *
 * El SyncEnqueuer registra hooks en cada tabla Dexie. Dexie 4.x NO expone
 * un mecanismo de unsubscribe para los hooks, así que si la app reinstala
 * el enqueuer (e.g. por React.StrictMode en dev, o por HMR de Vite), los
 * hooks viejos siguen enganchados y los nuevos se acumulan encima. Cada
 * `db.patients.put()` dispara TODOS los hooks registrados → enqueue
 * duplicado y, en el peor caso, datos encolados 2-3 veces.
 *
 * Solución: singleton a nivel de módulo. Una sola instancia para toda
 * la vida del bundle. `init()` es idempotente.
 */

import { db } from "@services/db";
import { SyncEnqueuer } from "@services/sync/syncEnqueuer";
import { SyncQueueRepository } from "@services/sync/syncQueueRepository";

let _instance: SyncEnqueuer | null = null;

export function getSyncEnqueuer(): SyncEnqueuer {
  if (!_instance) {
    _instance = new SyncEnqueuer(db, new SyncQueueRepository(db.sync_queue));
    _instance.start();
  }
  return _instance;
}

/** Sólo para tests: resetea el singleton entre casos. */
export function __resetSyncEnqueuerForTests(): void {
  if (_instance) {
    _instance.stop();
    _instance = null;
  }
}
