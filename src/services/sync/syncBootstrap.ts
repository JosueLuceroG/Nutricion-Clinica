/**
 * Bootstrap del SyncEngine: persistencia de lastPullAt + helpers de start/stop.
 *
 * - lastPullAt se guarda en la tabla Dexie sync_meta (durable, no se pierde
 *   al limpiar localStorage).
 * - El engine se crea lazy (en el primer sync()) y se reusa entre llamadas.
 * - start() arranca el ciclo peri\u00f3dico; stop() lo cancela.
 */

import { type NutriClinicaDB } from "@services/db/dexieSchema";
import { SyncQueueRepository } from "./syncQueueRepository.js";
import {
  SyncEngine,
  type SyncEngineDeps,
  type SyncEvent,
} from "./syncEngine.js";
import { syncApi } from "./syncApiClient.js";
import type { SyncOp } from "@modules/sync/domain/SyncQueueItem";
import { useAuthStore } from "@store/authStore";
import { useSyncStore } from "@store/syncStore";
import { toast } from "sonner";
import type { SyncableEntity, SyncPullCursors } from "@nutriclinica/shared";
import { requireActiveSucursalId } from "@services/tenancy/sucursalScope";

const TABLE_TO_ENTITY: Record<string, SyncableEntity> = {
  patients: "pacientes",
  consultations: "consultas",
  anthropometry: "antropometrias",
  lab_panels: "lab_panels",
  meal_plans: "planes_alimenticios",
  adherence_records: "adherence_records",
};

const LAST_PULL_AT_PREFIX = "lastPullAt:";

function lastPullAtKey(sucursalId: string): string {
  return `${LAST_PULL_AT_PREFIX}${sucursalId}`;
}

function getLastPullAt(
  db: NutriClinicaDB,
  sucursalId: string,
): Promise<SyncPullCursors | null> {
  return db.sync_meta
    .get(lastPullAtKey(sucursalId))
    .then((row) => {
      const value = row?.value;
      if (typeof value !== "string") return null;
      try {
        const parsed: unknown = JSON.parse(value);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as SyncPullCursors;
        }
      } catch {
        // formato legacy (ISO único) o corrupto: primer pull completo
      }
      return null;
    })
    .catch(() => null);
}

function setLastPullAt(
  db: NutriClinicaDB,
  sucursalId: string,
  cursors: SyncPullCursors,
): Promise<void> {
  return db.sync_meta
    .put({ key: lastPullAtKey(sucursalId), value: JSON.stringify(cursors) })
    .then(() => undefined)
    .catch(() => undefined);
}

let engineInstance: SyncEngine | null = null;
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let authUnsubscribers: Array<() => void> = [];

export function getSyncEngine(db: NutriClinicaDB): SyncEngine {
  if (engineInstance) return engineInstance;
  const queue = new SyncQueueRepository(db.sync_queue);
  const deps: SyncEngineDeps = {
    db,
    queue,
    getLastPullAt: (sucursalId: string) => getLastPullAt(db, sucursalId),
    setLastPullAt: (sucursalId: string, cursors: SyncPullCursors) =>
      setLastPullAt(db, sucursalId, cursors),
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

export function startSync(
  db: NutriClinicaDB,
  options: StartOptions = {},
): void {
  const engine = getSyncEngine(db);
  const { intervalMs = 30_000, runOnStart = true, onEvent } = options;

  // Importante: limpiar subscripciones previas antes de re-registrarlas.
  // En React 18 dev (StrictMode) el useEffect de App.tsx corre el
  // cleanup (stopSync) y luego setup (startSync) otra vez; sin esto
  // acumulamos N copias del mismo handler y cada cambio de estado
  // dispara trabajo duplicado (causa visible de lentitud al navegar).
  for (const unsub of authUnsubscribers) unsub();
  authUnsubscribers = [];

  // Cuando el usuario cambia de sucursal, refrescar.
  authUnsubscribers.push(
    useAuthStore.subscribe((state) => {
      const newId = state.sucursalActivaId;
      const prevId = useSyncStore.getState().sucursalId;
      if (newId !== prevId) {
        useSyncStore.getState().setSucursalId(newId);
      }
    }),
  );

  // Auto-reconciliación al login: si el usuario creó datos offline
  // (Dexie tiene filas pero sync_queue no las tiene porque el enqueuer
  // no estaba montado o por un bug), las encolamos y empujamos.
  // Se ejecuta UNA VEZ por sesión (false→true en isAuthenticated).
  let wasAuthenticated = useAuthStore.getState().isAuthenticated;
  authUnsubscribers.push(
    useAuthStore.subscribe((state) => {
      const isAuth = state.isAuthenticated;
      if (isAuth && !wasAuthenticated) {
        wasAuthenticated = true;
        void (async () => {
          try {
            const result = await reconcileAllPendingChanges(
              db,
              requireActiveSucursalId(),
            );
            if (result.enqueued > 0) {
              toast.info(
                `${result.enqueued} cambio${result.enqueued === 1 ? "" : "s"} detectado${result.enqueued === 1 ? "" : "s"} offline`,
                { description: "Sincronizando con el servidor…" },
              );
              await engine.sync();
            }
          } catch {
            /* el error ya queda en el syncStore */
          }
        })();
      } else if (!isAuth) {
        wasAuthenticated = false;
      }
    }),
  );

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
    // Bridge simple: el engine no tiene onEvent público más allá de deps.onProgress;
    // para uso real, el caller puede envolver getSyncEngine() con sus propios deps.
    void onEvent;
  }
}

export function stopSync(): void {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  for (const unsub of authUnsubscribers) unsub();
  authUnsubscribers = [];
}

export interface ReconcileResult {
  scanned: number;
  enqueued: number;
  byEntity: Record<string, number>;
}

/**
 * Reconciliación: escanea todas las tablas sincronizables y encola como
 * `create` cualquier fila que no tenga ya un item pendiente en
 * `sync_queue`. Útil para empujar datos creados ANTES de montar el
 * SyncEnqueuer (e.g. al primer login tras una sesión offline larga, o
 * tras un bug del enqueuer que dejó filas sin encolar).
 *
 * No encola duplicados: si ya hay un item (entity, entityId) en
 * cualquier estado (`pending`, `syncing`, `error`, `conflict`) para esa
 * fila, se respeta. Solo agrega los que faltan.
 *
 * Idempotente: se puede correr varias veces sin efecto extra.
 */
export async function reconcileAllPendingChanges(
  db: NutriClinicaDB,
  sucursalId = requireActiveSucursalId(),
): Promise<ReconcileResult> {
  const queue = new SyncQueueRepository(db.sync_queue);
  const result: ReconcileResult = { scanned: 0, enqueued: 0, byEntity: {} };

  // 1) Indexar lo que ya está en sync_queue por (entity, entityId).
  const allQueueItems = await queue.listAll(sucursalId);
  const known = new Set(allQueueItems.map((i) => `${i.entity}::${i.entityId}`));

  // 2) Recorrer cada tabla sincronizable.
  for (const [tableName, entity] of Object.entries(TABLE_TO_ENTITY)) {
    const table = (
      db as unknown as Record<string, { toArray: () => Promise<unknown[]> }>
    )[tableName];
    if (!table) continue;
    const rows = await table.toArray();
    for (const row of rows) {
      const r = row as {
        id: unknown;
        sucursal_id?: string | null;
        deleted_at?: string | null;
      };
      // Saltar filas soft-deleted: el usuario las borró localmente,
      // no tiene sentido empujar el create al server.
      if (r.deleted_at) continue;
      if (r.sucursal_id !== sucursalId) continue;
      result.scanned++;
      const id = String(r.id);
      const key = `${entity}::${id}`;
      if (known.has(key)) continue;
      await queue.enqueue({
        sucursalId,
        entity,
        entityId: id,
        op: "create" as SyncOp,
        payload: row,
      });
      known.add(key);
      result.enqueued++;
      result.byEntity[entity] = (result.byEntity[entity] ?? 0) + 1;
    }
  }

  return result;
}
