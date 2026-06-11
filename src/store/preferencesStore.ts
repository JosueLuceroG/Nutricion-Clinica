import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PreferencesState {
  language: "es-MX" | "en-US";
  dateFormat: "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd";
  currency: "MXN" | "USD" | "EUR";
  decimalPlaces: 1 | 2;
  setLanguage: (lang: PreferencesState["language"]) => void;
  setDateFormat: (format: PreferencesState["dateFormat"]) => void;
  setCurrency: (currency: PreferencesState["currency"]) => void;
  setDecimalPlaces: (decimals: PreferencesState["decimalPlaces"]) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      language: "es-MX",
      dateFormat: "dd/MM/yyyy",
      currency: "MXN",
      decimalPlaces: 1,
      setLanguage: (language) => set({ language }),
      setDateFormat: (dateFormat) => set({ dateFormat }),
      setCurrency: (currency) => set({ currency }),
      setDecimalPlaces: (decimalPlaces) => set({ decimalPlaces }),
    }),
    { name: "preferences-store" },
  ),
);
