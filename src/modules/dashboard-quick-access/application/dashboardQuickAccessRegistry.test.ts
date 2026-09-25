import { describe, expect, it } from "vitest";
import { DASHBOARD_QUICK_ACCESS_ACTION_IDS } from "../domain";
import {
  DASHBOARD_QUICK_ACCESS_DEFINITIONS,
  getDashboardQuickAccessAvailability,
  getDashboardQuickAccessDefinition,
} from "./dashboardQuickAccessRegistry";

const adminContext = {
  role: "admin",
  sucursalId: "branch-1",
  dashboardEditing: false,
  dashboardCustomizerAvailable: true,
};

describe("dashboardQuickAccessRegistry", () => {
  it("defines every stable action ID exactly once", () => {
    const ids = DASHBOARD_QUICK_ACCESS_DEFINITIONS.map(
      (definition) => definition.id,
    );

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids)).toEqual(new Set(DASHBOARD_QUICK_ACCESS_ACTION_IDS));
  });

  it("enforces branch and write requirements", () => {
    const createPatient = getDashboardQuickAccessDefinition(
      "patients.patient.create",
    );

    expect(
      getDashboardQuickAccessAvailability(createPatient, {
        ...adminContext,
        sucursalId: null,
      }),
    ).toEqual({
      enabled: false,
      reasonKey: "dashboardQuickAccess.reasons.branchRequired",
    });
    expect(
      getDashboardQuickAccessAvailability(createPatient, {
        role: "asistente",
        sucursalId: "branch-1",
      }),
    ).toEqual({
      enabled: false,
      reasonKey: "dashboardQuickAccess.reasons.permissionDenied",
    });
  });

  it("aligns finance actions with the route role policy", () => {
    expect(
      getDashboardQuickAccessAvailability(
        getDashboardQuickAccessDefinition("patients.directory.open"),
        { role: "asistente", sucursalId: "branch-1" },
      ).enabled,
    ).toBe(true);
    expect(
      getDashboardQuickAccessAvailability(
        getDashboardQuickAccessDefinition("finance.billing.open"),
        { role: "asistente", sucursalId: "branch-1" },
      ).enabled,
    ).toBe(true);
    expect(
      getDashboardQuickAccessAvailability(
        getDashboardQuickAccessDefinition("finance.report.open"),
        { role: "asistente", sucursalId: "branch-1" },
      ).enabled,
    ).toBe(false);
    expect(
      getDashboardQuickAccessAvailability(
        getDashboardQuickAccessDefinition("finance.billing.open"),
        { role: "facturacion", sucursalId: "branch-1" },
      ).enabled,
    ).toBe(true);
  });

  it("disables placeholders and repeated dashboard editing", () => {
    expect(
      getDashboardQuickAccessAvailability(
        getDashboardQuickAccessDefinition("patients.reminder.send"),
        adminContext,
      ),
    ).toEqual({
      enabled: false,
      reasonKey: "dashboardQuickAccess.reasons.comingSoon",
    });
    expect(
      getDashboardQuickAccessAvailability(
        getDashboardQuickAccessDefinition("dashboard.customize"),
        { ...adminContext, dashboardEditing: true },
      ),
    ).toEqual({
      enabled: false,
      reasonKey: "dashboardQuickAccess.reasons.alreadyEditing",
    });
  });

  it("preserves dashboard customization for authenticated roles", () => {
    const customize = getDashboardQuickAccessDefinition("dashboard.customize");

    for (const role of [
      "admin",
      "nutriologa",
      "asistente",
      "soporte_tecnico",
      "auditor",
      "facturacion",
    ]) {
      expect(
        getDashboardQuickAccessAvailability(customize, {
          role,
          sucursalId: "branch-1",
          dashboardCustomizerAvailable: true,
        }).enabled,
      ).toBe(true);
    }
  });
});
