import { describe, expect, it } from "vitest";
import {
  clinicalAlertPreferencesStorageKey,
  createClinicalAlertPreferencesStore,
  type ClinicalAlertPreferencesStorage,
  type ClinicalAlertScope,
} from "./clinicalAlertPreferencesStore";

class MemoryStorage implements ClinicalAlertPreferencesStorage {
  values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const firstScope: ClinicalAlertScope = { userId: "user/1", sucursalId: "branch:a" };
const secondScope: ClinicalAlertScope = { userId: "user/1", sucursalId: "branch:b" };

describe("clinicalAlertPreferencesStore", () => {
  it("uses safe defaults and ignores saves before activation", () => {
    const storage = new MemoryStorage();
    const store = createClinicalAlertPreferencesStore(storage);

    expect(store.getState().savePreferences({
      ...store.getState().preferences,
      enabled: false,
    })).toBe(false);
    expect(store.getState().preferences).toMatchObject({
      enabled: true,
      popupEnabled: true,
      desktopEnabled: false,
      upcomingConsultation: { enabled: true, lead: 10 },
    });
  });

  it("persists independently for each user and branch", () => {
    const storage = new MemoryStorage();
    const store = createClinicalAlertPreferencesStore(storage);
    expect(clinicalAlertPreferencesStorageKey(firstScope)).toBe(
      "nutriclinica.clinical-alert-preferences.v1:user:user%2F1:branch:id:branch%3Aa",
    );

    store.getState().activateScope(firstScope);
    store.getState().savePreferences({
      ...store.getState().preferences,
      upcomingConsultation: { enabled: true, lead: 30 },
    });
    store.getState().activateScope(secondScope);
    expect(store.getState().preferences.upcomingConsultation.lead).toBe(10);

    store.getState().activateScope(firstScope);
    expect(store.getState().preferences.upcomingConsultation.lead).toBe(30);
  });

  it("normalizes malformed values and can restore defaults", () => {
    const storage = new MemoryStorage();
    storage.setItem(clinicalAlertPreferencesStorageKey(firstScope), JSON.stringify({
      preferences: {
        enabled: false,
        popupEnabled: "yes",
        upcomingConsultation: { enabled: false, lead: 999 },
      },
    }));
    const store = createClinicalAlertPreferencesStore(storage);
    store.getState().activateScope(firstScope);

    expect(store.getState().preferences).toMatchObject({
      enabled: false,
      popupEnabled: true,
      upcomingConsultation: { enabled: false, lead: 10 },
    });

    expect(store.getState().resetPreferences()).toBe(true);
    expect(store.getState().preferences).toMatchObject({
      enabled: true,
      upcomingConsultation: { enabled: true, lead: 10 },
    });
  });
});
