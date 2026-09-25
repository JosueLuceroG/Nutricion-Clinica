import { create, type StoreApi, type UseBoundStore } from "zustand";
import {
  createDefaultDashboardQuickAccessConfig,
  createDefaultDashboardQuickAccessSnapshot,
  parseDashboardQuickAccessConfig,
  type DashboardQuickAccessConfig,
  type DashboardQuickAccessLoadResult,
  type DashboardQuickAccessRepository,
  type DashboardQuickAccessScope,
} from "@modules/dashboard-quick-access/domain";
import {
  dashboardQuickAccessStorageKey,
  localStorageDashboardQuickAccessRepository,
} from "@modules/dashboard-quick-access/infrastructure";

export type DashboardQuickAccessHydrationStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error";
export type DashboardQuickAccessPersistenceStatus =
  | "idle"
  | "saving"
  | "saved"
  | "error";

export interface DashboardQuickAccessStoreState {
  scope: DashboardQuickAccessScope | null;
  scopeKey: string | null;
  config: DashboardQuickAccessConfig;
  hydrationStatus: DashboardQuickAccessHydrationStatus;
  persistenceStatus: DashboardQuickAccessPersistenceStatus;
  error: string | null;
  warning: string | null;
  hasInvalidStoredData: boolean;
  activateScope: (scope: DashboardQuickAccessScope) => Promise<void>;
  deactivateScope: () => Promise<void>;
  saveConfig: (config: DashboardQuickAccessConfig) => Promise<boolean>;
  reset: () => Promise<boolean>;
  retry: () => Promise<boolean>;
}

export interface DashboardQuickAccessStoreDependencies {
  repository?: DashboardQuickAccessRepository;
  now?: () => Date | string;
}

function cloneConfig(
  config: DashboardQuickAccessConfig,
): DashboardQuickAccessConfig {
  return {
    ...config,
    secondaryActionIds: [...config.secondaryActionIds],
  };
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createDashboardQuickAccessStore(
  dependencies: DashboardQuickAccessStoreDependencies = {},
): UseBoundStore<StoreApi<DashboardQuickAccessStoreState>> {
  const repository =
    dependencies.repository ?? localStorageDashboardQuickAccessRepository;
  const now = dependencies.now ?? (() => new Date());

  let persistedRevision = 0;
  let loadRequest = 0;
  let activeSave: Promise<boolean> | null = null;
  let retryConfig: DashboardQuickAccessConfig | null = null;
  let retryScopeKey: string | null = null;

  const timestamp = (): string => {
    const value = now();
    return typeof value === "string" ? value : value.toISOString();
  };

  const store = create<DashboardQuickAccessStoreState>((set, get) => {
    const activateScope = async (
      requestedScope: DashboardQuickAccessScope,
    ): Promise<void> => {
      const request = ++loadRequest;
      const scope = { ...requestedScope };
      const scopeKey = dashboardQuickAccessStorageKey(scope);
      persistedRevision = 0;
      retryConfig = null;
      retryScopeKey = null;
      set({
        scope,
        scopeKey,
        config: createDefaultDashboardQuickAccessConfig(),
        hydrationStatus: "loading",
        persistenceStatus: "idle",
        error: null,
        warning: null,
        hasInvalidStoredData: false,
      });

      let result: DashboardQuickAccessLoadResult;
      try {
        result = await repository.load(scope);
      } catch (error) {
        if (request === loadRequest && get().scopeKey === scopeKey) {
          set({
            hydrationStatus: "error",
            error: messageFrom(error),
          });
        }
        return;
      }
      if (request !== loadRequest || get().scopeKey !== scopeKey) return;

      if (result.status === "unavailable") {
        set({
          hydrationStatus: "error",
          error: result.message,
        });
        return;
      }

      if (result.status === "invalid") {
        set({
          config: createDefaultDashboardQuickAccessConfig(),
          hydrationStatus: "ready",
          persistenceStatus: "idle",
          error: null,
          warning: result.message,
          hasInvalidStoredData: true,
        });
        return;
      }

      if (result.status === "found") {
        persistedRevision = result.snapshot.revision;
        set({
          config: cloneConfig(result.snapshot.config),
          hydrationStatus: "ready",
          persistenceStatus: "idle",
          error: null,
          warning: null,
          hasInvalidStoredData: false,
        });
        return;
      }

      set({
        config: createDefaultDashboardQuickAccessConfig(),
        hydrationStatus: "ready",
        persistenceStatus: "idle",
        error: null,
        warning: null,
        hasInvalidStoredData: false,
      });
    };

    const saveOnce = async (
      config: DashboardQuickAccessConfig,
      expectedScopeKey: string,
    ): Promise<boolean> => {
      const state = get();
      if (
        !state.scope ||
        state.scopeKey !== expectedScopeKey ||
        state.hydrationStatus !== "ready"
      ) {
        return false;
      }

      const scope = { ...state.scope };
      const request = loadRequest;
      let snapshot;
      try {
        snapshot = createDefaultDashboardQuickAccessSnapshot(
          scope,
          timestamp(),
        );
        snapshot.config = cloneConfig(config);
        snapshot.revision = persistedRevision + 1;
      } catch (error) {
        set({ persistenceStatus: "error", error: messageFrom(error) });
        return false;
      }

      set({ persistenceStatus: "saving", error: null });
      try {
        const saved = await repository.save(scope, snapshot);
        if (request !== loadRequest || get().scopeKey !== expectedScopeKey) {
          return true;
        }
        persistedRevision = saved.revision;
        retryConfig = null;
        retryScopeKey = null;
        set({
          config: cloneConfig(saved.config),
          persistenceStatus: "saved",
          error: null,
          warning: null,
          hasInvalidStoredData: false,
        });
        return true;
      } catch (error) {
        if (request === loadRequest && get().scopeKey === expectedScopeKey) {
          retryConfig = cloneConfig(config);
          retryScopeKey = expectedScopeKey;
          set({
            persistenceStatus: "error",
            error: messageFrom(error),
          });
        }
        return false;
      }
    };

    const saveConfig = async (
      config: DashboardQuickAccessConfig,
    ): Promise<boolean> => {
      const parsed = parseDashboardQuickAccessConfig(config);
      if (!parsed) {
        set({
          persistenceStatus: "error",
          error: "The dashboard quick access config is invalid",
        });
        return false;
      }

      const expectedScopeKey = get().scopeKey;
      if (!expectedScopeKey || get().hydrationStatus !== "ready") return false;
      if (activeSave) await activeSave;
      if (
        get().scopeKey !== expectedScopeKey ||
        get().hydrationStatus !== "ready"
      ) {
        return false;
      }

      const operation = saveOnce(parsed, expectedScopeKey);
      activeSave = operation;
      const succeeded = await operation;
      if (activeSave === operation) activeSave = null;
      return succeeded;
    };

    return {
      scope: null,
      scopeKey: null,
      config: createDefaultDashboardQuickAccessConfig(),
      hydrationStatus: "idle",
      persistenceStatus: "idle",
      error: null,
      warning: null,
      hasInvalidStoredData: false,

      activateScope,

      deactivateScope: async () => {
        loadRequest += 1;
        persistedRevision = 0;
        retryConfig = null;
        retryScopeKey = null;
        set({
          scope: null,
          scopeKey: null,
          config: createDefaultDashboardQuickAccessConfig(),
          hydrationStatus: "idle",
          persistenceStatus: "idle",
          error: null,
          warning: null,
          hasInvalidStoredData: false,
        });
      },

      saveConfig,

      reset: () => saveConfig(createDefaultDashboardQuickAccessConfig()),

      retry: async () => {
        const state = get();
        if (state.hydrationStatus === "error" && state.scope) {
          await activateScope(state.scope);
          return get().hydrationStatus === "ready";
        }
        if (
          state.persistenceStatus === "error" &&
          retryConfig &&
          retryScopeKey === state.scopeKey
        ) {
          return saveConfig(cloneConfig(retryConfig));
        }
        return state.hydrationStatus === "ready";
      },
    };
  });

  return store;
}

export const useDashboardQuickAccessStore = createDashboardQuickAccessStore();
