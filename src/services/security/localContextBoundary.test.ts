import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import {
  clearLocalContext,
  isLocalContextTransitioning,
} from "./localContextBoundary";

describe("localContextBoundary", () => {
  let db: NutriClinicaDB;

  beforeEach(async () => {
    db = new NutriClinicaDB(`context-${crypto.randomUUID()}`);
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it("refuses to clear a context with unresolved outbox work", async () => {
    await db.patients.put({ id: "patient-1", sucursal_id: "branch-1" } as never);
    await db.sync_queue.put({
      id: "operation-1",
      sucursalId: "branch-1",
      entity: "pacientes",
      entityId: "patient-1",
      op: "update",
      payload: "{}",
      status: "pending",
      attempted: false,
      retryCount: 0,
      lastError: null,
      enqueuedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as never);

    await expect(clearLocalContext(db)).rejects.toThrow(/cambios pendientes/);
    expect(await db.patients.get("patient-1")).toBeDefined();
    expect(isLocalContextTransitioning()).toBe(false);
  });

  it("clears clinical/context tables without clearing shared catalogs", async () => {
    await db.patients.put({ id: "patient-1", sucursal_id: "branch-1" } as never);
    await db.sync_meta.put({ key: "lastPullAt:branch-1", value: "{}" });
    await db.recipes.put({ id: "recipe-1", name: "Shared recipe" } as never);

    await clearLocalContext(db);

    expect(await db.patients.get("patient-1")).toBeUndefined();
    expect(await db.sync_meta.get("lastPullAt:branch-1")).toBeUndefined();
    expect(await db.recipes.get("recipe-1")).toBeDefined();
    expect(isLocalContextTransitioning()).toBe(false);
  });
});
