import {
  DashboardQuickAccessRepositoryError,
  parseDashboardQuickAccessSnapshot,
  type DashboardQuickAccessRepository,
  type DashboardQuickAccessScope,
  type DashboardQuickAccessSnapshot,
} from "../domain";

export const DASHBOARD_QUICK_ACCESS_STORAGE_PREFIX =
  "nutriclinica.dashboard-quick-access.v1";

export interface DashboardQuickAccessStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type DashboardQuickAccessStorageSupplier =
  () => DashboardQuickAccessStorage | null;

function scopesEqual(
  first: DashboardQuickAccessScope,
  second: DashboardQuickAccessScope,
): boolean {
  return (
    first.userId === second.userId && first.sucursalId === second.sucursalId
  );
}

export function dashboardQuickAccessStorageKey(
  scope: DashboardQuickAccessScope,
): string {
  const user = encodeURIComponent(scope.userId);
  const branch =
    scope.sucursalId === null
      ? "none"
      : `id:${encodeURIComponent(scope.sucursalId)}`;
  return `${DASHBOARD_QUICK_ACCESS_STORAGE_PREFIX}:user:${user}:branch:${branch}`;
}

function defaultStorageSupplier(): DashboardQuickAccessStorage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? `${fallback}: ${error.message}` : fallback;
}

async function withStorageLock<T>(key: string, operation: () => T): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.locks) {
    return operation();
  }
  return navigator.locks.request(
    `nutriclinica.dashboard-quick-access:${key}`,
    operation,
  );
}

export class LocalStorageDashboardQuickAccessRepository implements DashboardQuickAccessRepository {
  constructor(
    private readonly storageSupplier: DashboardQuickAccessStorageSupplier = defaultStorageSupplier,
  ) {}

  async load(scope: DashboardQuickAccessScope) {
    let storage: DashboardQuickAccessStorage | null;
    try {
      storage = this.storageSupplier();
    } catch (error) {
      return {
        status: "unavailable" as const,
        message: errorMessage(
          error,
          "Dashboard quick access storage is unavailable",
        ),
      };
    }
    if (!storage) {
      return {
        status: "unavailable" as const,
        message: "Dashboard quick access storage is unavailable",
      };
    }

    let raw: string | null;
    try {
      raw = storage.getItem(dashboardQuickAccessStorageKey(scope));
    } catch (error) {
      return {
        status: "unavailable" as const,
        message: errorMessage(
          error,
          "Dashboard quick access storage could not be read",
        ),
      };
    }
    if (raw === null) return { status: "missing" as const };

    let value: unknown;
    try {
      value = JSON.parse(raw) as unknown;
    } catch (error) {
      return {
        status: "invalid" as const,
        message: errorMessage(
          error,
          "Stored dashboard quick access JSON is malformed",
        ),
        raw,
      };
    }

    const snapshot = parseDashboardQuickAccessSnapshot(value);
    if (!snapshot) {
      return {
        status: "invalid" as const,
        message: "Stored dashboard quick access data is invalid",
        raw,
      };
    }
    if (!scopesEqual(scope, snapshot.scope)) {
      return {
        status: "invalid" as const,
        message: "Stored dashboard quick access scope does not match its key",
        raw,
      };
    }
    return { status: "found" as const, snapshot };
  }

  async save(
    scope: DashboardQuickAccessScope,
    snapshot: DashboardQuickAccessSnapshot,
  ): Promise<DashboardQuickAccessSnapshot> {
    const parsed = parseDashboardQuickAccessSnapshot(snapshot);
    if (!parsed || !scopesEqual(scope, parsed.scope)) {
      throw new DashboardQuickAccessRepositoryError(
        "invalid",
        "Dashboard quick access snapshot is invalid for this scope",
      );
    }

    let storage: DashboardQuickAccessStorage | null;
    try {
      storage = this.storageSupplier();
    } catch (error) {
      throw new DashboardQuickAccessRepositoryError(
        "unavailable",
        errorMessage(error, "Dashboard quick access storage is unavailable"),
        { cause: error },
      );
    }
    if (!storage) {
      throw new DashboardQuickAccessRepositoryError(
        "unavailable",
        "Dashboard quick access storage is unavailable",
      );
    }

    try {
      const key = dashboardQuickAccessStorageKey(scope);
      await withStorageLock(key, () => {
        const currentRaw = storage.getItem(key);
        if (currentRaw !== null) {
          let current: DashboardQuickAccessSnapshot | null = null;
          try {
            current = parseDashboardQuickAccessSnapshot(
              JSON.parse(currentRaw) as unknown,
            );
          } catch {
            // An explicit save may replace malformed data shown as a warning.
          }
          const expectedRevision = parsed.revision - 1;
          if (
            current &&
            scopesEqual(scope, current.scope) &&
            current.revision !== expectedRevision
          ) {
            throw new DashboardQuickAccessRepositoryError(
              "conflict",
              "Dashboard quick access changed in another window. Reload and try again.",
            );
          }
        }
        storage.setItem(key, JSON.stringify(parsed));
      });
    } catch (error) {
      if (error instanceof DashboardQuickAccessRepositoryError) throw error;
      throw new DashboardQuickAccessRepositoryError(
        "unavailable",
        errorMessage(
          error,
          "Dashboard quick access storage could not be written",
        ),
        { cause: error },
      );
    }
    return parsed;
  }
}

export const localStorageDashboardQuickAccessRepository =
  new LocalStorageDashboardQuickAccessRepository();
