import type { DashboardPreferences, DashboardScope } from "@app/pages/dashboard/customization/dashboardWidgetTypes";
import { parseDashboardPreferences } from "@app/pages/dashboard/customization/dashboardLayoutSchema";
import { migrateDashboardPreferences } from "@app/pages/dashboard/customization/dashboardLayoutMigration";
import type { DashboardPreferencesLoadResult, DashboardPreferencesRepository } from "./DashboardPreferencesRepository";

const STORAGE_PREFIX = "nutriclinica.dashboard.v1";

export function dashboardStorageKey(scope: DashboardScope): string {
  const user = encodeURIComponent(scope.userId);
  const branch = scope.sucursalId === null ? "none" : `id:${encodeURIComponent(scope.sucursalId)}`;
  return `${STORAGE_PREFIX}:user:${user}:branch:${branch}`;
}

export function legacyDashboardStorageKey(scope: DashboardScope): string {
  return `${STORAGE_PREFIX}:${scope.userId}:${scope.sucursalId ?? "global"}`;
}

export class LocalDashboardPreferencesRepository implements DashboardPreferencesRepository {
  load(scope: DashboardScope): DashboardPreferences | null {
    const result = this.loadResult(scope);
    return result.status === "found" ? result.preferences : null;
  }

  loadResult(scope: DashboardScope): DashboardPreferencesLoadResult {
    try {
      const key = dashboardStorageKey(scope);
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        const legacyRaw = window.localStorage.getItem(legacyDashboardStorageKey(scope));
        if (!legacyRaw) return { status: "missing" };
        const legacyValue: unknown = JSON.parse(legacyRaw);
        const legacy = parseDashboardPreferences(legacyValue) ?? migrateDashboardPreferences(legacyValue);
        if (!legacy || legacy.userId !== scope.userId || legacy.sucursalId !== scope.sucursalId) {
          return { status: "invalid", message: "La configuración anterior del dashboard no es válida y se conservó sin cambios." };
        }
        try {
          window.localStorage.setItem(key, JSON.stringify(legacy));
        } catch {
          // The valid legacy value remains usable even if migration cannot be persisted.
        }
        return { status: "found", preferences: legacy };
      }
      const storedValue: unknown = JSON.parse(raw);
      const current = parseDashboardPreferences(storedValue);
      const parsed = current ?? migrateDashboardPreferences(storedValue);
      if (!parsed || parsed.userId !== scope.userId || parsed.sucursalId !== scope.sucursalId) {
        return { status: "invalid", message: "La configuración guardada no es compatible y se conservó sin cambios." };
      }
      if (!current) window.localStorage.setItem(key, JSON.stringify(parsed));
      return { status: "found", preferences: parsed };
    } catch (error) {
      return {
        status: "invalid",
        message: error instanceof Error
          ? `No se pudo leer la configuración guardada: ${error.message}`
          : "No se pudo leer la configuración guardada.",
      };
    }
  }

  save(scope: DashboardScope, preferences: DashboardPreferences): DashboardPreferences {
    const parsed = parseDashboardPreferences(preferences);
    if (!parsed || parsed.userId !== scope.userId || parsed.sucursalId !== scope.sucursalId) {
      throw new Error("La configuración del dashboard no es válida.");
    }
    window.localStorage.setItem(dashboardStorageKey(scope), JSON.stringify(parsed));
    return parsed;
  }

  reset(scope: DashboardScope): void {
    window.localStorage.removeItem(dashboardStorageKey(scope));
    window.localStorage.removeItem(legacyDashboardStorageKey(scope));
  }
}

export const localDashboardPreferencesRepository = new LocalDashboardPreferencesRepository();
