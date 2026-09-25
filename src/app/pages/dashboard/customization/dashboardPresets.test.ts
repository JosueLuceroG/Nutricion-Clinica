import { describe, expect, it } from "vitest";
import {
  createDashboardPreset,
  createDefaultDashboardPreferences,
  getNextDashboardPosition,
} from "./dashboardPresets";
import type { DashboardWidgetPosition } from "./dashboardWidgetTypes";

function positionsOverlap(
  first: DashboardWidgetPosition,
  second: DashboardWidgetPosition,
): boolean {
  return (
    first.x < second.x + second.w &&
    first.x + first.w > second.x &&
    first.y < second.y + second.h &&
    first.y + first.h > second.y
  );
}

describe("dashboard presets", () => {
  it("crea el preset default con 10 widgets dentro de la grilla y sin superposiciones", () => {
    const preferences = createDashboardPreset("default", {
      userId: "user-1",
      sucursalId: "branch-1",
    });

    expect(preferences.widgets).toHaveLength(10);
    expect(preferences.layout).toHaveLength(10);
    expect(preferences.smallScreenOrder).toHaveLength(10);
    expect(
      new Set(preferences.widgets.map((widget) => widget.instanceId)).size,
    ).toBe(10);

    const instanceIds = new Set(
      preferences.widgets.map((widget) => widget.instanceId),
    );
    for (const position of preferences.layout) {
      expect(instanceIds.has(position.i)).toBe(true);
      expect(position.x).toBeGreaterThanOrEqual(0);
      expect(position.y).toBeGreaterThanOrEqual(0);
      expect(position.w).toBeGreaterThan(0);
      expect(position.h).toBeGreaterThan(0);
      expect(position.x + position.w).toBeLessThanOrEqual(12);
      expect(position.y + position.h).toBeLessThanOrEqual(
        preferences.grid.maxRows,
      );
    }

    for (let index = 0; index < preferences.layout.length; index += 1) {
      for (
        let otherIndex = index + 1;
        otherIndex < preferences.layout.length;
        otherIndex += 1
      ) {
        expect(
          positionsOverlap(
            preferences.layout[index]!,
            preferences.layout[otherIndex]!,
          ),
        ).toBe(false);
      }
    }
  });

  it("migra el orden y los KPI ocultos de las preferencias legacy", () => {
    const preferences = createDefaultDashboardPreferences(
      { userId: "legacy-user", sucursalId: null },
      {
        kpiOrder: [
          "pendingPayments",
          "activePatients",
          "incomeThisMonth",
          "consultationsToday",
        ],
        hiddenKpiIds: ["incomeThisMonth"],
      },
    );

    expect(preferences.smallScreenOrder.slice(0, 4)).toEqual([
      "pendingPayments",
      "activePatients",
      "incomeThisMonth",
      "consultationsToday",
    ]);
    expect(preferences.smallScreenOrder).toContain("incomeThisMonth");

    const topRowX = Object.fromEntries(
      preferences.layout
        .filter((position) => position.y === 0)
        .map((position) => [position.i, position.x]),
    );
    expect(topRowX).toMatchObject({
      pendingPayments: 0,
      activePatients: 3,
      consultationsToday: 6,
    });
    expect(topRowX).not.toHaveProperty("incomeThisMonth");

    expect(
      preferences.widgets.find(
        (widget) => widget.definitionId === "incomeThisMonth",
      )?.hidden,
    ).toBe(true);
    expect(
      preferences.widgets
        .filter((widget) => widget.definitionId !== "incomeThisMonth")
        .every((widget) => !widget.hidden),
    ).toBe(true);
  });

  it("coloca un widget nuevo en el primer espacio disponible", () => {
    const next = getNextDashboardPosition(
      [
        { i: "first", x: 0, y: 0, w: 3, h: 3 },
        { i: "third", x: 6, y: 0, w: 3, h: 3 },
      ],
      "activePatients",
      "new-widget",
    );
    expect(next).toMatchObject({ i: "new-widget", x: 3, y: 0, w: 3, h: 3 });
  });
});
