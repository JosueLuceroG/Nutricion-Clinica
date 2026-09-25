import { describe, expect, it } from "vitest";
import { createDashboardPreset } from "./dashboardPresets";
import { parseDashboardPreferences } from "./dashboardLayoutSchema";

describe("parseDashboardPreferences", () => {
  it("acepta un payload válido", () => {
    const preferences = createDashboardPreset("clinical", {
      userId: "user-1",
      sucursalId: "branch-1",
    });

    expect(parseDashboardPreferences(preferences)).toEqual(preferences);
  });

  it.each([
    [
      "versión desconocida",
      (valid: ReturnType<typeof createDashboardPreset>) => ({
        ...valid,
        schemaVersion: valid.schemaVersion + 1,
      }),
    ],
    [
      "usuario vacío",
      (valid: ReturnType<typeof createDashboardPreset>) => ({
        ...valid,
        userId: "",
      }),
    ],
    [
      "posición fuera de la grilla",
      (valid: ReturnType<typeof createDashboardPreset>) => ({
        ...valid,
        layout: [{ ...valid.layout[0]!, x: -1 }, ...valid.layout.slice(1)],
      }),
    ],
    [
      "widget corrupto",
      (valid: ReturnType<typeof createDashboardPreset>) => ({
        ...valid,
        widgets: [
          { ...valid.widgets[0]!, hidden: "yes" },
          ...valid.widgets.slice(1),
        ],
      }),
    ],
    [
      "límites de filas inválidos",
      (valid: ReturnType<typeof createDashboardPreset>) => ({
        ...valid,
        grid: { ...valid.grid, maxRows: 31 },
      }),
    ],
    [
      "ancho que desborda la grilla",
      (valid: ReturnType<typeof createDashboardPreset>) => ({
        ...valid,
        layout: [{ ...valid.layout[0]!, x: 10, w: 3 }, ...valid.layout.slice(1)],
      }),
    ],
    [
      "widgets superpuestos",
      (valid: ReturnType<typeof createDashboardPreset>) => ({
        ...valid,
        layout: [valid.layout[0]!, { ...valid.layout[1]!, x: 0, y: 0 }, ...valid.layout.slice(2)],
      }),
    ],
    [
      "widget visible sin posición",
      (valid: ReturnType<typeof createDashboardPreset>) => ({
        ...valid,
        layout: valid.layout.slice(1),
      }),
    ],
    [
      "identificadores duplicados",
      (valid: ReturnType<typeof createDashboardPreset>) => ({
        ...valid,
        smallScreenOrder: [valid.smallScreenOrder[0]!, ...valid.smallScreenOrder],
      }),
    ],
    [
      "campo de KPI ajeno a su fuente",
      (valid: ReturnType<typeof createDashboardPreset>) => ({
        ...valid,
        customKpis: [{
          id: "forged-kpi",
          name: "KPI alterado",
          description: "",
          iconKey: "sparkles",
          tone: "purple",
          category: "custom",
          source: "system",
          metric: "sum",
          valueField: "payments.incomeThisMonth",
          filters: [],
          comparison: "none",
          visualization: "largeNumber",
          format: "currency",
          size: "small",
          createdAt: valid.updatedAt,
          updatedAt: valid.updatedAt,
        }],
      }),
    ],
  ])("rechaza corrupción en %s", (_description, corrupt) => {
    const valid = createDashboardPreset("default", {
      userId: "user-1",
      sucursalId: null,
    });

    expect(parseDashboardPreferences(corrupt(valid))).toBeNull();
  });
});
