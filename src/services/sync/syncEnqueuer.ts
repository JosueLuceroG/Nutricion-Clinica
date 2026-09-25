import type { NutriClinicaDB } from "@services/db/dexieSchema";
import type { SyncQueueRepository } from "./syncQueueRepository.js";

declare global {
  var __syncApplying: boolean | undefined;
  var __syncRunning: boolean | undefined;
}

// These flags describe the engine for diagnostics/backup exclusion only.
// Outbox suppression is transaction-scoped in atomicOutbox.ts.
export function setSyncApplying(value: boolean): void {
  globalThis.__syncApplying = value;
}
export function isSyncApplying(): boolean {
  return globalThis.__syncApplying === true;
}
export function setSyncRunning(value: boolean): void {
  globalThis.__syncRunning = value;
}
export function isSyncRunning(): boolean {
  return globalThis.__syncRunning === true;
}

/** Compatibility lifecycle: capture is installed when the DB is constructed. */
export class SyncEnqueuer {
  constructor(private readonly db: NutriClinicaDB, _queue: SyncQueueRepository) {}

  start(): void {
    this.db.syncOutboxEnabled = true;
  }

  stop(): void {
    // Stopping network sync must never disable durable local mutation capture.
  }
}
