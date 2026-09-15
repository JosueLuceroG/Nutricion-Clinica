/**
 * Item de la cola de sincronización local (Dexie sync_queue).
 *
 * Cada mutación (create/update/delete) sobre una entidad sincronizable
 * genera un item. El SyncEngine lo lee en el push y lo marca como
 * applied / conflict / error.
 */

import type { SyncableEntity } from "@nutriclinica/shared";

export type SyncOp = "create" | "update" | "delete";
export type SyncItemStatus =
  | "pending"
  | "syncing"
  | "applied"
  | "conflict"
  | "error";

export interface SyncQueueItem {
  /** UUID server-side asignado por la cola. */
  id: string;
  /** Sucursal inmutable que era activa al crear la mutación. */
  sucursalId: string;
  entity: SyncableEntity;
  entityId: string;
  op: SyncOp;
  /** Snapshot del entity en el momento de la mutación (stringify JSON). */
  payload: string;
  status: SyncItemStatus;
  retryCount: number;
  lastError: string | null;
  /** row_version conocido por el cliente al momento de la mutación (opcional). */
  expectedRowVersion: string | null;
  enqueuedAt: string;
  updatedAt: string;
  /** Set before network I/O: an attempted payload can never be coalesced. */
  attempted?: boolean;
  createsEntity?: boolean;
  restoreDeleted?: boolean;
  /** Previous unacknowledged revision of this entity. */
  predecessorId?: string;
  serverPayload?: Record<string, unknown> | null;
  serverRowVersion?: string;
  serverDeleted?: boolean;
}
