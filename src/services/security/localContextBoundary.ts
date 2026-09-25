import type { NutriClinicaDB } from "@services/db/dexieSchema";
import { markRemoteTransaction } from "@services/sync/atomicOutbox";
import { withDatabaseOperationLock } from "@services/sync/databaseOperationLock";
import {
  enterLocalContextTransition,
  leaveLocalContextTransition,
} from "./localContextState";

// Catalogs are not tied to a patient, user, role, or branch. Everything else
// is cleared when a local security context ends.
const PRESERVED_TABLES = new Set([
  "smae_custom_foods",
  "recipes",
  "medication_catalog",
  "nutrient_interactions",
  "bia_devices",
  "indicators",
]);
const LOCAL_DRAFT_PREFIX = "draft:";

export { isLocalContextTransitioning } from "./localContextState";

/**
 * Removes local patient data only after all durable mutations are settled.
 * The transaction is marked remote so clearing sync-managed tables cannot
 * manufacture delete operations in the outbox.
 */
export async function clearLocalContext(db: NutriClinicaDB): Promise<void> {
  enterLocalContextTransition();
  try {
    await withDatabaseOperationLock(async () => {
      const tables = db.tables.filter((table) => !PRESERVED_TABLES.has(table.name));
      await db.transaction("rw", tables, async () => {
        const unresolved = await db.sync_queue
          .filter((item) => item.status !== "applied")
          .count();
        if (unresolved > 0) {
          throw new Error(
            "Sincroniza o resuelve todos los cambios pendientes antes de cerrar sesión",
          );
        }

        markRemoteTransaction();
        for (const table of tables) await table.clear();
      });
      clearLocalDrafts();
    });
  } finally {
    leaveLocalContextTransition();
  }
}

function clearLocalDrafts(): void {
  if (typeof localStorage === "undefined") return;

  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(LOCAL_DRAFT_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}
