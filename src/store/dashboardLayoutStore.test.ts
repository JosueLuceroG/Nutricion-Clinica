import { beforeEach, describe, expect, it } from "vitest";
import {
  dashboardStorageKey,
  localDashboardPreferencesRepository,
} from "@services/dashboard/LocalDashboardPreferencesRepository";
import type { DashboardScope } from "@app/pages/dashboard/customization/dashboardWidgetTypes";
import { useDashboardLayoutStore } from "./dashboardLayoutStore";

const scope: DashboardScope = { userId: "store-user", sucursalId: "branch-1" };

function resetStore(): void {
  useDashboardLayoutStore.setState({
    scopeKey: null,
    scope: null,
    saved: null,
    draft: null,
    isEditing: false,
    isDirty: false,
    error: null,
  });
}

describe("dashboardLayoutStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetStore();
  });

  it("hidrata, crea un draft independiente y cancela los cambios", () => {
    useDashboardLayoutStore.getState().hydrate(scope);

    let state = useDashboardLayoutStore.getState();
    expect(state.saved?.widgets).toHaveLength(10);
    expect(state.draft).toEqual(state.saved);
    expect(state.draft).not.toBe(state.saved);
    expect(
      window.localStorage.getItem(dashboardStorageKey(scope)),
    ).not.toBeNull();

    state.beginEditing();
    useDashboardLayoutStore.getState().toggleWidgetHidden("activePatients");

    state = useDashboardLayoutStore.getState();
    expect(state.isEditing).toBe(true);
    expect(state.isDirty).toBe(true);
    expect(
      state.draft?.widgets.find(
        (widget) => widget.instanceId === "activePatients",
      )?.hidden,
    ).toBe(true);
    expect(state.draft?.layout.some((position) => position.i === "activePatients")).toBe(false);
    expect(
      state.saved?.widgets.find(
        (widget) => widget.instanceId === "activePatients",
      )?.hidden,
    ).toBe(false);

    state.cancelEditing();
    state = useDashboardLayoutStore.getState();
    expect(state.isEditing).toBe(false);
    expect(state.isDirty).toBe(false);
    expect(state.draft).toEqual(state.saved);
    expect(
      state.draft?.widgets.find(
        (widget) => widget.instanceId === "activePatients",
      )?.hidden,
    ).toBe(false);
  });

  it("guarda el draft y lo recupera desde la persistencia", () => {
    useDashboardLayoutStore.getState().hydrate(scope);
    const originalRevision = useDashboardLayoutStore.getState().saved?.revision;
    useDashboardLayoutStore.getState().beginEditing();
    useDashboardLayoutStore.getState().toggleWidgetHidden("pendingPayments");

    expect(useDashboardLayoutStore.getState().saveDraft()).toBe(true);

    let state = useDashboardLayoutStore.getState();
    expect(state.saved?.revision).not.toBe(originalRevision);
    expect(state.isEditing).toBe(false);
    expect(state.isDirty).toBe(false);
    expect(
      localDashboardPreferencesRepository
        .load(scope)
        ?.widgets.find((widget) => widget.instanceId === "pendingPayments")
        ?.hidden,
    ).toBe(true);

    resetStore();
    useDashboardLayoutStore.getState().hydrate(scope);
    state = useDashboardLayoutStore.getState();
    expect(
      state.saved?.widgets.find(
        (widget) => widget.instanceId === "pendingPayments",
      )?.hidden,
    ).toBe(true);
  });

  it("aplica presets y permite agregar y remover widgets antes de persistir", () => {
    useDashboardLayoutStore.getState().hydrate(scope);
    useDashboardLayoutStore.getState().beginEditing();
    useDashboardLayoutStore.getState().applyPreset("empty");

    expect(useDashboardLayoutStore.getState().draft?.widgets).toEqual([]);

    useDashboardLayoutStore.getState().addWidget("activePatients");
    let draft = useDashboardLayoutStore.getState().draft;
    expect(draft?.widgets.map((widget) => widget.instanceId)).toEqual([
      "activePatients",
    ]);
    expect(draft?.layout.map((position) => position.i)).toEqual([
      "activePatients",
    ]);
    expect(draft?.smallScreenOrder).toEqual(["activePatients"]);

    useDashboardLayoutStore.getState().addWidget("activePatients");
    expect(useDashboardLayoutStore.getState().draft?.widgets).toHaveLength(1);

    useDashboardLayoutStore.getState().removeWidget("activePatients");
    draft = useDashboardLayoutStore.getState().draft;
    expect(draft?.widgets).toEqual([]);
    expect(draft?.layout).toEqual([]);
    expect(draft?.smallScreenOrder).toEqual([]);

    useDashboardLayoutStore.getState().applyPreset("clinical");
    draft = useDashboardLayoutStore.getState().draft;
    expect(draft?.activePresetId).toBe("clinical");
    expect(draft?.widgets).toHaveLength(8);
    expect(useDashboardLayoutStore.getState().saveDraft()).toBe(true);
    expect(
      localDashboardPreferencesRepository.load(scope)?.activePresetId,
    ).toBe("clinical");
  });

  it("cambia tamaño sin superponer widgets y controla filas manuales", () => {
    useDashboardLayoutStore.getState().hydrate(scope);
    useDashboardLayoutStore.getState().beginEditing();
    useDashboardLayoutStore.getState().setWidgetSize("activePatients", "wide");
    useDashboardLayoutStore.getState().setRowsMode("manual");
    useDashboardLayoutStore.getState().adjustMinRows(1);

    const draft = useDashboardLayoutStore.getState().draft!;
    const activePatients = draft.layout.find((item) => item.i === "activePatients")!;
    expect(activePatients.w).toBe(6);
    expect(draft.grid.rowsMode).toBe("manual");
    expect(draft.grid.minRows).toBeGreaterThan(17);

    for (let index = 0; index < draft.layout.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < draft.layout.length; otherIndex += 1) {
        const first = draft.layout[index]!;
        const second = draft.layout[otherIndex]!;
        const overlap = first.x < second.x + second.w &&
          first.x + first.w > second.x &&
          first.y < second.y + second.h &&
          first.y + first.h > second.y;
        expect(overlap).toBe(false);
      }
    }
  });

  it("aplica el tamaño elegido al crear un KPI personalizado", () => {
    useDashboardLayoutStore.getState().hydrate(scope);
    useDashboardLayoutStore.getState().beginEditing();
    const now = new Date().toISOString();
    useDashboardLayoutStore.getState().addCustomKpi({
      id: "custom-wide",
      name: "KPI ancho",
      description: "",
      iconKey: "sparkles",
      tone: "purple",
      category: "custom",
      source: "patients",
      metric: "count",
      valueField: "patients.active",
      filters: [],
      comparison: "none",
      visualization: "largeNumber",
      format: "number",
      size: "wide",
      createdAt: now,
      updatedAt: now,
    });
    useDashboardLayoutStore.getState().addWidget("customKpi", "custom-wide", "wide");

    const draft = useDashboardLayoutStore.getState().draft!;
    const widget = draft.widgets.find((item) => item.config.customKpiId === "custom-wide")!;
    expect(draft.layout.find((position) => position.i === widget.instanceId)?.w).toBe(6);
    expect(useDashboardLayoutStore.getState().saveDraft()).toBe(true);
  });
});
