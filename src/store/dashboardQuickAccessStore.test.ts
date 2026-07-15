import { describe, expect, it } from "vitest";
import {
  createDefaultDashboardQuickAccessConfig,
  createDefaultDashboardQuickAccessSnapshot,
  type DashboardQuickAccessConfig,
  type DashboardQuickAccessLoadResult,
  type DashboardQuickAccessRepository,
  type DashboardQuickAccessScope,
  type DashboardQuickAccessSnapshot,
} from "@modules/dashboard-quick-access/domain";
import { createDashboardQuickAccessStore } from "./dashboardQuickAccessStore";

const scope: DashboardQuickAccessScope = {
  userId: "store-user",
  sucursalId: "branch-1",
};

function menuConfig(): DashboardQuickAccessConfig {
  return {
    mode: "menu",
    buttonLabel: "Clinical",
    buttonIconId: "stethoscope",
    primaryActionId: "clinical.consultations.open",
    secondaryActionIds: [
      "clinical.consultation.create",
      "clinical.agenda.today.open",
    ],
  };
}

function createStore(repository: DashboardQuickAccessRepository) {
  return createDashboardQuickAccessStore({
    repository,
    now: () => "2026-07-14T10:00:00.000Z",
  });
}

describe("dashboardQuickAccessStore", () => {
  it("hydrates missing data with defaults without writing", async () => {
    let saves = 0;
    const repository: DashboardQuickAccessRepository = {
      load: async () => ({ status: "missing" }),
      save: async (_requestedScope, snapshot) => {
        saves += 1;
        return snapshot;
      },
    };
    const store = createStore(repository);

    await store.getState().activateScope(scope);

    expect(store.getState()).toMatchObject({
      config: createDefaultDashboardQuickAccessConfig(),
      hydrationStatus: "ready",
      persistenceStatus: "idle",
      hasInvalidStoredData: false,
    });
    expect(saves).toBe(0);
  });

  it("uses defaults with a warning for invalid data", async () => {
    const repository: DashboardQuickAccessRepository = {
      load: async () => ({
        status: "invalid",
        message: "Future data",
        raw: '{"schemaVersion":2}',
      }),
      save: async (_requestedScope, snapshot) => snapshot,
    };
    const store = createStore(repository);

    await store.getState().activateScope(scope);

    expect(store.getState()).toMatchObject({
      config: createDefaultDashboardQuickAccessConfig(),
      hydrationStatus: "ready",
      warning: "Future data",
      hasInvalidStoredData: true,
    });
  });

  it("treats unavailable storage as a hydration error", async () => {
    const repository: DashboardQuickAccessRepository = {
      load: async () => ({
        status: "unavailable",
        message: "Storage unavailable",
      }),
      save: async (_requestedScope, snapshot) => snapshot,
    };
    const store = createStore(repository);

    await store.getState().activateScope(scope);

    expect(store.getState()).toMatchObject({
      hydrationStatus: "error",
      error: "Storage unavailable",
    });
  });

  it("does not apply a stale scope load after a newer activation", async () => {
    const firstScope = { userId: "race-user", sucursalId: "first" };
    const secondScope = { userId: "race-user", sucursalId: "second" };
    const pending = new Map<
      string,
      (result: DashboardQuickAccessLoadResult) => void
    >();
    const repository: DashboardQuickAccessRepository = {
      load: (requestedScope) =>
        new Promise((resolve) => {
          pending.set(requestedScope.sucursalId!, resolve);
        }),
      save: async (_requestedScope, snapshot) => snapshot,
    };
    const store = createStore(repository);

    const firstActivation = store.getState().activateScope(firstScope);
    const secondActivation = store.getState().activateScope(secondScope);
    const secondSnapshot = createDefaultDashboardQuickAccessSnapshot(
      secondScope,
      "2026-07-14T10:00:00.000Z",
    );
    secondSnapshot.config = menuConfig();
    pending.get("second")!({ status: "found", snapshot: secondSnapshot });
    await secondActivation;
    pending.get("first")!({
      status: "found",
      snapshot: createDefaultDashboardQuickAccessSnapshot(firstScope),
    });
    await firstActivation;

    expect(store.getState()).toMatchObject({
      scope: secondScope,
      config: menuConfig(),
      hydrationStatus: "ready",
    });
  });

  it("does not update config when saving fails", async () => {
    const repository: DashboardQuickAccessRepository = {
      load: async () => ({ status: "missing" }),
      save: async () => {
        throw new Error("Write failed");
      },
    };
    const store = createStore(repository);
    await store.getState().activateScope(scope);

    await expect(store.getState().saveConfig(menuConfig())).resolves.toBe(
      false,
    );

    expect(store.getState()).toMatchObject({
      config: createDefaultDashboardQuickAccessConfig(),
      persistenceStatus: "error",
      error: "Write failed",
    });
  });

  it("resets by explicitly saving defaults at the next revision", async () => {
    const loaded = createDefaultDashboardQuickAccessSnapshot(
      scope,
      "2026-07-14T09:00:00.000Z",
    );
    loaded.config = menuConfig();
    loaded.revision = 4;
    const saved: DashboardQuickAccessSnapshot[] = [];
    const repository: DashboardQuickAccessRepository = {
      load: async () => ({ status: "found", snapshot: loaded }),
      save: async (_requestedScope, snapshot) => {
        saved.push(snapshot);
        return snapshot;
      },
    };
    const store = createStore(repository);
    await store.getState().activateScope(scope);

    await expect(store.getState().reset()).resolves.toBe(true);

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      config: createDefaultDashboardQuickAccessConfig(),
      revision: 5,
    });
    expect(store.getState()).toMatchObject({
      config: createDefaultDashboardQuickAccessConfig(),
      persistenceStatus: "saved",
    });
  });
});
