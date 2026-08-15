import { create, type StateCreator } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import {
  createDefaultClinicalAlertPreferences,
  parseClinicalAlertPreferences,
  type ClinicalAlertPreferences,
} from "@modules/clinical-alerts/domain/clinicalAlertPreferences";

export interface ClinicalAlertScope {
  userId: string;
  sucursalId: string | null;
}

export interface ClinicalAlertPreferencesStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ClinicalAlertPreferencesState {
  scope: ClinicalAlertScope | null;
  scopeKey: string | null;
  hydrationStatus: "idle" | "ready";
  preferences: ClinicalAlertPreferences;
  error: string | null;
  activateScope: (scope: ClinicalAlertScope) => void;
  deactivateScope: () => void;
  savePreferences: (preferences: ClinicalAlertPreferences) => boolean;
  resetPreferences: () => boolean;
}

export const CLINICAL_ALERT_PREFERENCES_STORAGE_PREFIX = "nutriclinica.clinical-alert-preferences.v1";

export function clinicalAlertPreferencesStorageKey(scope: ClinicalAlertScope): string {
  const user = encodeURIComponent(scope.userId);
  const branch = scope.sucursalId === null ? "none" : `id:${encodeURIComponent(scope.sucursalId)}`;
  return `${CLINICAL_ALERT_PREFERENCES_STORAGE_PREFIX}:user:${user}:branch:${branch}`;
}

function browserStorage(): ClinicalAlertPreferencesStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function createClinicalAlertPreferencesState(
  storage: ClinicalAlertPreferencesStorage | null,
): StateCreator<ClinicalAlertPreferencesState> {
  return (set, get) => ({
    scope: null,
    scopeKey: null,
    hydrationStatus: "idle",
    preferences: createDefaultClinicalAlertPreferences(),
    error: null,
    activateScope: (scope) => {
      const scopeKey = clinicalAlertPreferencesStorageKey(scope);
      let preferences = createDefaultClinicalAlertPreferences();
      let error: string | null = null;
      try {
        const raw = storage?.getItem(scopeKey);
        if (raw) {
          const parsed = JSON.parse(raw) as { preferences?: unknown };
          preferences = parseClinicalAlertPreferences(parsed.preferences);
        }
      } catch (cause) {
        error = cause instanceof Error ? cause.message : String(cause);
      }
      set({ scope: { ...scope }, scopeKey, hydrationStatus: "ready", preferences, error });
    },
    deactivateScope: () => {
      set({
        scope: null,
        scopeKey: null,
        hydrationStatus: "idle",
        preferences: createDefaultClinicalAlertPreferences(),
        error: null,
      });
    },
    savePreferences: (nextPreferences) => {
      const state = get();
      if (state.hydrationStatus !== "ready" || !state.scopeKey) return false;
      const preferences = parseClinicalAlertPreferences(nextPreferences);
      try {
        storage?.setItem(state.scopeKey, JSON.stringify({ preferences }));
        set({ preferences, error: null });
        return true;
      } catch (cause) {
        set({ error: cause instanceof Error ? cause.message : String(cause) });
        return false;
      }
    },
    resetPreferences: () => get().savePreferences(createDefaultClinicalAlertPreferences()),
  });
}

export function createClinicalAlertPreferencesStore(
  storage: ClinicalAlertPreferencesStorage | null = browserStorage(),
): StoreApi<ClinicalAlertPreferencesState> {
  return createStore<ClinicalAlertPreferencesState>(createClinicalAlertPreferencesState(storage));
}

export const useClinicalAlertPreferencesStore = create<ClinicalAlertPreferencesState>(
  createClinicalAlertPreferencesState(browserStorage()),
);
