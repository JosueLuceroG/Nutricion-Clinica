import { beforeEach, describe, expect, it } from "vitest";
import { createDashboardPreset } from "@app/pages/dashboard/customization/dashboardPresets";
import type { DashboardScope } from "@app/pages/dashboard/customization/dashboardWidgetTypes";
import {
  dashboardStorageKey,
  legacyDashboardStorageKey,
  LocalDashboardPreferencesRepository,
} from "./LocalDashboardPreferencesRepository";

describe("LocalDashboardPreferencesRepository", () => {
  let repository: LocalDashboardPreferencesRepository;

  beforeEach(() => {
    window.localStorage.clear();
    repository = new LocalDashboardPreferencesRepository();
  });

  it("aísla las preferencias por usuario y sucursal", () => {
    const north: DashboardScope = { userId: "user-1", sucursalId: "north" };
    const south: DashboardScope = { userId: "user-1", sucursalId: "south" };
    const otherUser: DashboardScope = { userId: "user-2", sucursalId: "north" };

    repository.save(north, createDashboardPreset("default", north));
    repository.save(south, createDashboardPreset("clinical", south));
    repository.save(otherUser, createDashboardPreset("financial", otherUser));

    expect(repository.load(north)?.activePresetId).toBe("default");
    expect(repository.load(south)?.activePresetId).toBe("clinical");
    expect(repository.load(otherUser)?.activePresetId).toBe("financial");
    expect(
      repository.load({ userId: "user-3", sucursalId: "north" }),
    ).toBeNull();
    expect(
      new Set([
        dashboardStorageKey(north),
        dashboardStorageKey(south),
        dashboardStorageKey(otherUser),
      ]).size,
    ).toBe(3);
  });

  it("devuelve null y no lanza cuando el JSON almacenado está corrupto", () => {
    const scope: DashboardScope = { userId: "user-1", sucursalId: null };
    window.localStorage.setItem(dashboardStorageKey(scope), "{not-valid-json");

    expect(() => repository.load(scope)).not.toThrow();
    expect(repository.load(scope)).toBeNull();
  });

  it("rechaza un payload válido guardado bajo un scope distinto", () => {
    const source: DashboardScope = { userId: "user-1", sucursalId: "north" };
    const target: DashboardScope = { userId: "user-1", sucursalId: "south" };
    window.localStorage.setItem(
      dashboardStorageKey(target),
      JSON.stringify(createDashboardPreset("default", source)),
    );

    expect(repository.load(target)).toBeNull();
  });

  it("genera claves distintas para scope global, sucursal global e IDs con separadores", () => {
    const keys = [
      dashboardStorageKey({ userId: "user:1", sucursalId: null }),
      dashboardStorageKey({ userId: "user:1", sucursalId: "global" }),
      dashboardStorageKey({ userId: "user", sucursalId: "1:global" }),
    ];

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("migra una clave anterior válida sin borrar el valor original", () => {
    const scope: DashboardScope = { userId: "legacy-user", sucursalId: "branch" };
    const preferences = createDashboardPreset("clinical", scope);
    const legacyKey = legacyDashboardStorageKey(scope);
    window.localStorage.setItem(legacyKey, JSON.stringify(preferences));

    expect(repository.load(scope)?.activePresetId).toBe("clinical");
    expect(window.localStorage.getItem(dashboardStorageKey(scope))).not.toBeNull();
    expect(window.localStorage.getItem(legacyKey)).not.toBeNull();
  });

  it("repara una configuración anterior que usaba límites y posiciones obsoletos", () => {
    const scope: DashboardScope = { userId: "legacy-layout-user", sucursalId: "branch" };
    const preferences = createDashboardPreset("default", scope);
    const hiddenId = preferences.widgets[0]!.instanceId;
    const alerts = preferences.layout.find((position) => position.i === "alerts")!;
    preferences.widgets[0]!.hidden = true;
    preferences.smallScreenOrder = preferences.smallScreenOrder.filter((id) => id !== hiddenId);
    alerts.minW = 4;
    window.localStorage.setItem(legacyDashboardStorageKey(scope), JSON.stringify(preferences));

    const result = repository.loadResult(scope);

    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    expect(result.preferences.smallScreenOrder).toContain(hiddenId);
    expect(result.preferences.layout.some((position) => position.i === hiddenId)).toBe(false);
    expect(result.preferences.layout.find((position) => position.i === "alerts")?.minW).toBe(3);
    expect(window.localStorage.getItem(dashboardStorageKey(scope))).not.toBeNull();
  });

  it("actualiza widgets complejos y recupera su tamaño mínimo legible", () => {
    const scope: DashboardScope = { userId: "legacy-widget-user", sucursalId: "branch" };
    const preferences = createDashboardPreset("default", scope);
    const financialWidget = preferences.widgets.find((widget) => widget.definitionId === "financialSummary")!;
    const financialPosition = preferences.layout.find((position) => position.i === financialWidget.instanceId)!;
    financialWidget.definitionVersion = 1;
    financialPosition.h = 5;
    financialPosition.minH = 5;
    window.localStorage.setItem(dashboardStorageKey(scope), JSON.stringify(preferences));

    const result = repository.loadResult(scope);

    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    expect(result.preferences.widgets.find((widget) => widget.instanceId === financialWidget.instanceId)?.definitionVersion).toBe(2);
    expect(result.preferences.layout.find((position) => position.i === financialWidget.instanceId)?.h).toBeGreaterThanOrEqual(6);
    expect(result.preferences.layout.find((position) => position.i === financialWidget.instanceId)?.minH).toBe(6);
  });

  it("actualiza los anchos mínimos de widgets que ahora admiten modo compacto", () => {
    const scope: DashboardScope = { userId: "compact-widget-user", sucursalId: "branch" };
    const preferences = createDashboardPreset("default", scope);
    const paymentsWidget = preferences.widgets.find((widget) => widget.definitionId === "recentPayments")!;
    const paymentsPosition = preferences.layout.find((position) => position.i === paymentsWidget.instanceId)!;
    paymentsWidget.definitionVersion = 2;
    paymentsPosition.minW = 4;
    window.localStorage.setItem(dashboardStorageKey(scope), JSON.stringify(preferences));

    const result = repository.loadResult(scope);

    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    expect(result.preferences.widgets.find((widget) => widget.instanceId === paymentsWidget.instanceId)?.definitionVersion).toBe(3);
    expect(result.preferences.layout.find((position) => position.i === paymentsWidget.instanceId)?.minW).toBe(3);
  });

  it("reporta un payload incompatible y lo conserva sin sobrescribir", () => {
    const scope: DashboardScope = { userId: "future-user", sucursalId: null };
    const key = dashboardStorageKey(scope);
    const future = { ...createDashboardPreset("default", scope), schemaVersion: 2 };
    const raw = JSON.stringify(future);
    window.localStorage.setItem(key, raw);

    expect(repository.loadResult(scope).status).toBe("invalid");
    expect(window.localStorage.getItem(key)).toBe(raw);
  });
});
