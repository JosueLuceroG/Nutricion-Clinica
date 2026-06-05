import * as React from "react";
import { db } from "@services/db";
import { getSyncEngine } from "./syncBootstrap";
import { SyncQueueRepository } from "./syncQueueRepository";
import { useAuthStore } from "@store/authStore";
import { useSyncStore } from "@store/syncStore";

const queue = new SyncQueueRepository(db.sync_queue);

/**
 * Hook que expone acciones de sync + contadores reactivos.
 *
 * - syncNow(): dispara un ciclo de sync (engine reusa la inFlight si hay una en curso).
 * - refreshCounts(): actualiza los contadores de pendientes y conflictos.
 * - conflictCount / pendingCount: derivados del syncStore + Dexie.
 */
export function useSyncActions() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setPending = useSyncStore((s) => s.setPendingChanges);
  const [conflictCount, setConflictCount] = React.useState(0);

  const refreshCounts = React.useCallback(async () => {
    const [pending, conflicts] = await Promise.all([
      queue.countPending(),
      queue.countConflicts(),
    ]);
    setPending(pending);
    setConflictCount(conflicts);
  }, [setPending]);

  React.useEffect(() => {
    void refreshCounts();
    const interval = setInterval(() => { void refreshCounts(); }, 5_000);
    return () => clearInterval(interval);
  }, [refreshCounts]);

  const syncNow = React.useCallback(async () => {
    if (!isAuthenticated) return;
    const engine = getSyncEngine(db);
    try {
      await engine.sync();
    } catch {
      /* el engine ya actualiz\u00f3 el syncStore con el error */
    } finally {
      await refreshCounts();
    }
  }, [isAuthenticated, refreshCounts]);

  return { syncNow, refreshCounts, conflictCount };
}
