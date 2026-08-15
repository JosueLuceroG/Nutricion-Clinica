import { afterEach, describe, expect, it, vi } from "vitest";
import { filterAndRankGlobalSearch } from "./globalSearchEngine";
import {
  buildSettingsSearchResults,
  focusSettingsSection,
} from "./globalSettingsSearch";

const translations: Record<string, string> = {
  "settings.title": "Configuración",
  "settings.data_backup": "Respaldo de datos",
  "settings.export_backup_desc": "Exporta toda la base de datos.",
  "settings.restore_backup": "Restaurar respaldo",
  "settings.restore_backup_desc": "Importa un archivo de respaldo.",
  "settings.preferences": "Preferencias",
  "settings.preferences_desc": "Tema, idioma, fecha, zona horaria y unidades.",
  "settings.workspace_title": "SaaS y experiencia",
  "settings.workspace_desc": "Modo de uso, plan y marca.",
  "settings.patient_record_number_title": "Número de expediente clínico",
  "settings.patient_record_number_description":
    "Formato automático del expediente.",
  "ai.title": "Asistente IA",
  "ai.enable_desc": "Configura el asistente de inteligencia artificial.",
  "dashboardQuickAccess.settings.title": "Acceso rápido del dashboard",
  "dashboardQuickAccess.settings.description":
    "Configura el botón de acceso rápido.",
  "settings.dashboard_widgets_title": "KPIs del dashboard",
  "settings.dashboard_widgets_desc": "Organiza los KPIs y widgets.",
  "settings.clinical_sections_title": "Secciones del expediente",
  "settings.clinical_sections_desc": "Elige las secciones clínicas.",
  "clinicalAlerts.settings_title": "Alertas y recordatorios",
  "clinicalAlerts.settings_description": "Configura avisos para el nutriólogo.",
  "pricing.catalog_title": "Catálogo de precios",
  "pricing.catalog_desc": "Administra los precios.",
  "settings.admin_title": "Administración",
  "settings.admin_desc": "Gestión de usuarios, roles y sucursales.",
};

function buildResults(isAdmin = true) {
  return buildSettingsSearchResults({
    locale: "es-MX",
    isAdmin,
    translate: (key) => translations[key] ?? key,
  });
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("globalSettingsSearch", () => {
  it("registra rutas únicas para todas las tarjetas y secciones", () => {
    const results = buildResults();
    const ids = results.map((result) => result.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([
        "setting-data-backup",
        "setting-preferences",
        "setting-alternative-theme",
        "setting-motivational-card",
        "setting-patient-record-number",
        "setting-ai",
        "setting-dashboard-quick-access",
        "setting-dashboard-widgets",
        "setting-clinical-sections",
        "setting-clinical-alerts",
        "setting-pricing",
        "setting-administration",
      ]),
    );
    expect(results.every((result) => result.kind === "setting")).toBe(true);
    expect(
      results.every((result) =>
        result.path?.startsWith("/configuracion?section="),
      ),
    ).toBe(true);
  });

  it("encuentra card motivacional como la coincidencia principal", () => {
    const ranked = filterAndRankGlobalSearch(
      buildResults(),
      "card motivacional",
      "all",
    );

    expect(ranked[0]).toMatchObject({
      id: "setting-motivational-card",
      path: "/configuracion?section=motivational-card",
    });
  });

  it("encuentra la configuración de próxima consulta", () => {
    const ranked = filterAndRankGlobalSearch(
      buildResults(),
      "alerta proxima consulta",
      "all",
    );

    expect(ranked[0]).toMatchObject({
      id: "setting-clinical-alerts",
      path: "/configuracion?section=clinical-alerts",
    });
  });

  it("oculta la administración a usuarios sin rol admin", () => {
    expect(
      buildResults(false).some(
        (result) => result.id === "setting-administration",
      ),
    ).toBe(false);
    expect(
      buildResults(false).some((result) => result.id === "setting-data-backup"),
    ).toBe(false);
    expect(
      buildResults(false).some(
        (result) => result.id === "setting-restore-backup",
      ),
    ).toBe(false);
  });

  it("desplaza y enfoca la sección solicitada", () => {
    const target = document.createElement("section");
    target.tabIndex = -1;
    target.dataset.settingsSection = "motivational-card";
    target.scrollIntoView = vi.fn();
    document.body.append(target);

    expect(focusSettingsSection("motivational-card")).toBe(target);
    expect(target.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
    expect(document.activeElement).toBe(target);
  });
});
