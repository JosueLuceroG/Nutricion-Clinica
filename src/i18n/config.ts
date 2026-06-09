import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import esMX from "./locales/es-MX.json";
import enUS from "./locales/en-US.json";

export const defaultNS = "translation";

export const resources = {
  "es-MX": { translation: esMX },
  "en-US": { translation: enUS },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: "es-MX",
  fallbackLng: "es-MX",
  defaultNS,
  interpolation: { escapeValue: false },
});

export default i18n;
