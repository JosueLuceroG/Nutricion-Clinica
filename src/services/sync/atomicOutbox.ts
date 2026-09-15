import Dexie, { type DBCore } from "dexie";
import { canonicalSyncId, type SyncableEntity } from "@nutriclinica/shared";
import type { SyncQueueItem } from "@modules/sync/domain/SyncQueueItem";
import { getActiveSucursalId } from "@services/tenancy/sucursalScope";
import { isLocalContextTransitioning } from "@services/security/localContextState";

export const SYNC_TABLES: Record<string, SyncableEntity> = {
  patients: "pacientes",
  consultations: "consultas",
  anthropometry: "antropometrias",
  lab_panels: "lab_panels",
  meal_plans: "planes_alimenticios",
  adherence_records: "adherence_records",
};

const remoteTransactions = new WeakSet<object>();

/** Suppression belongs to this transaction, never to another concurrent edit. */
export function markRemoteTransaction(): void {
  const transaction = Dexie.currentTransaction;
  if (!transaction) throw new Error("Sync application requires a transaction");
  remoteTransactions.add(transaction.idbtrans);
}

type Row = Record<string, unknown>;
type OutboxDatabase = Dexie & { syncOutboxEnabled: boolean };

/**
 * DBCore expands the actual IndexedDB transaction before any entity write.
 * Entity, metadata and outbox use that same transaction, including bulk writes.
 */
export function installAtomicOutbox(db: OutboxDatabase): void {
  db.use({
    stack: "dbcore",
    name: "sync-atomic-outbox",
    level: 1,
    create: (down: DBCore): DBCore => ({
      ...down,
      transaction(stores, mode, options) {
        const capture = db.syncOutboxEnabled && mode === "readwrite" &&
          stores.some((name) => name in SYNC_TABLES);
        return down.transaction(
          capture ? [...new Set([...stores, "sync_queue"])] : stores,
          mode,
          options,
        );
      },
      table(name) {
        const table = down.table(name);
        const entity = SYNC_TABLES[name];
        if (!entity) return table;
        return {
          ...table,
          async mutate(request) {
            if (isLocalContextTransitioning() && !remoteTransactions.has(request.trans)) {
              request.trans.abort();
              throw new Error("LOCAL_CONTEXT_TRANSITION");
            }
            if (!db.syncOutboxEnabled || remoteTransactions.has(request.trans)) {
              return table.mutate(request);
            }
            try {
              // Capture fallback scope before the first IndexedDB await so a
              // concurrent branch switch cannot relabel this mutation.
              const activeBranch = getActiveSucursalId();
              const keys = request.type === "deleteRange"
                ? (await table.query({
                    trans: request.trans,
                    values: false,
                    query: { index: table.schema.primaryKey, range: request.range },
                  })).result as string[]
                : request.type === "delete"
                  ? request.keys as string[]
                  : request.values.map((value: Row) => String(value.id));
              if (new Set(keys.map((key) => canonicalSyncId(String(key)))).size !== keys.length) {
                throw new Error("DUPLICATE_SYNC_KEYS_IN_MUTATION");
              }
              const before = await table.getMany({ trans: request.trans, keys }) as Array<Row | undefined>;
              const queue = down.table("sync_queue");
              const values: Row[] = [];
              const queueWrites = new Map<string, SyncQueueItem>();
              const canceledIds: string[] = [];
              for (let index = 0; index < keys.length; index++) {
                const old = before[index];
                const deleting = request.type === "delete" || request.type === "deleteRange";
                if (deleting && !old) continue;
                const row: Row = deleting ? { ...old } : { ...request.values[index] };
                const rawBranch = old?.sucursal_id ?? row.sucursal_id ?? activeBranch;
                if (typeof rawBranch !== "string" || !rawBranch || rawBranch === "__unassigned__") {
                  throw new Error("Atomic sync write requires an assigned sucursal");
                }
                const branch = canonicalSyncId(rawBranch);
                if (typeof old?.sucursal_id === "string" && typeof row.sucursal_id === "string" &&
                  canonicalSyncId(old.sucursal_id) !== canonicalSyncId(row.sucursal_id)) {
                  throw new Error("A synced entity cannot change sucursal");
                }
                row.sucursal_id = branch;
                if (old?.row_version) row.row_version = old.row_version;
                let predecessor = typeof old?._syncHead === "string"
                  ? await queue.get({ trans: request.trans, key: old._syncHead }) as SyncQueueItem | undefined
                  : undefined;
                if (predecessor && (canonicalSyncId(predecessor.sucursalId) !== branch || predecessor.entity !== entity ||
                  canonicalSyncId(predecessor.entityId) !== canonicalSyncId(keys[index]!))) {
                  throw new Error("SYNC_LINEAGE_MISMATCH");
                }
                if (!predecessor && !old?._syncHead) {
                  let legacy = (await queue.query({ trans: request.trans, values: true,
                    query: { index: queue.schema.getIndexByKeyPath(["sucursalId", "entity", "entityId"])!,
                      range: { type: 1, lower: [branch, entity, keys[index]], upper: [branch, entity, keys[index]] } },
                  })).result as SyncQueueItem[];
                  if (legacy.length === 0 && rawBranch !== branch) {
                    legacy = (await queue.query({ trans: request.trans, values: true,
                      query: { index: queue.schema.getIndexByKeyPath(["sucursalId", "entity", "entityId"])!,
                        range: { type: 1, lower: [rawBranch, entity, keys[index]], upper: [rawBranch, entity, keys[index]] } },
                    })).result as SyncQueueItem[];
                  }
                  const unresolved = legacy.filter((item) => item.status !== "applied");
                  if (unresolved.length > 1) throw new Error("LEGACY_DUPLICATE_OPERATIONS_REQUIRE_REVIEW");
                  predecessor = unresolved[0];
                }
                const previous = predecessor;
                // `undefined` belongs to legacy records whose network history
                // is unknown. Only an explicit false is safe to rewrite.
                const coalesce = previous?.status === "pending" && previous.attempted === false;
                const tombstone = deleting || row.deleted_at != null;
                if (deleting) {
                  row.deleted_at = new Date().toISOString();
                  row.updated_at = typeof old?.updated_at === "number" ? Date.now() : row.deleted_at;
                }
                const cancelsUncommittedBaseline = coalesce && tombstone &&
                  ((previous.createsEntity ?? previous.op === "create") || previous.restoreDeleted === true);
                if (cancelsUncommittedBaseline) {
                  canceledIds.push(previous.id);
                  if (previous.predecessorId) row._syncHead = previous.predecessorId;
                  else delete row._syncHead;
                  if (previous.createsEntity ?? previous.op === "create") row._syncNeverSynced = true;
                  else delete row._syncNeverSynced;
                  values.push(row);
                  continue;
                }
                // Repeated edits/deletes of a locally canceled create remain
                // local-only until the row is explicitly restored.
                if (tombstone && old?._syncNeverSynced === true && !previous) {
                  delete row._syncHead;
                  row._syncNeverSynced = true;
                  values.push(row);
                  continue;
                }
                const id = coalesce ? previous.id : crypto.randomUUID();
                const createsEntity = coalesce
                  ? previous.createsEntity ?? previous.op === "create"
                  : (old?._syncNeverSynced === true && !old.row_version) || (!old && !previous);
                const op = tombstone ? "delete" : createsEntity ? "create" : "update";
                const now = new Date().toISOString();
                row._syncHead = id;
                if (!tombstone) delete row._syncNeverSynced;
                const payload = { ...row };
                delete payload._syncHead;
                delete payload._syncNeverSynced;
                queueWrites.set(id, {
                  id, sucursalId: branch, entity, entityId: keys[index]!, op,
                  createsEntity,
                  restoreDeleted: tombstone ? false : coalesce ? previous.restoreDeleted === true : old?.deleted_at != null,
                  payload: JSON.stringify(tombstone ? null : payload),
                  expectedRowVersion: coalesce ? previous.expectedRowVersion
                   : typeof old?.row_version === "string" ? old.row_version : null,
                  predecessorId: coalesce ? previous.predecessorId : previous?.id,
                  status: "pending", attempted: false, retryCount: 0, lastError: null,
                  enqueuedAt: coalesce ? previous.enqueuedAt : now, updatedAt: now,
                });
                // A new local edit is an explicit signal to resume a stable
                // predecessor that had exhausted automatic retries.
                if (!coalesce && previous?.status === "error") {
                  queueWrites.set(previous.id, {
                    ...previous,
                    status: "pending",
                    retryCount: 0,
                    lastError: null,
                    updatedAt: now,
                  });
                }
                values.push(row);
              }
              const result = await table.mutate(
                request.type === "add" || request.type === "put" ? { ...request, values }
                  : { type: "put", trans: request.trans, values },
              );
              // Even a caller catching BulkError may not commit half an outbox.
              if (result.numFailures) throw Object.values(result.failures)[0];
              if (canceledIds.length) {
                const canceled = await queue.mutate({ type: "delete", trans: request.trans, keys: canceledIds });
                if (canceled.numFailures) throw Object.values(canceled.failures)[0];
              }
              if (queueWrites.size) {
                const queued = await queue.mutate({ type: "put", trans: request.trans, values: [...queueWrites.values()] });
                if (queued.numFailures) throw Object.values(queued.failures)[0];
              }
              return result;
            } catch (error) {
              request.trans.abort();
              throw error;
            }
          },
        };
      },
    }),
  });
}
