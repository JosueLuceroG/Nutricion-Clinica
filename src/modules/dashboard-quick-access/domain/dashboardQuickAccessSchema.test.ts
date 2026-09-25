import { describe, expect, it } from "vitest";
import {
  DEFAULT_DASHBOARD_QUICK_ACCESS_CONFIG,
  createDefaultDashboardQuickAccessConfig,
  createDefaultDashboardQuickAccessSnapshot,
  parseDashboardQuickAccessConfig,
  parseDashboardQuickAccessSnapshot,
} from "./index";

const scope = { userId: "schema-user", sucursalId: null };

describe("dashboardQuickAccessSchema", () => {
  it("creates the exact default config and a valid v1 snapshot", () => {
    expect(createDefaultDashboardQuickAccessConfig()).toEqual({
      mode: "direct",
      buttonLabel: null,
      buttonIconId: null,
      primaryActionId: "dashboard.customize",
      secondaryActionIds: [],
    });
    expect(createDefaultDashboardQuickAccessConfig()).toEqual(
      DEFAULT_DASHBOARD_QUICK_ACCESS_CONFIG,
    );
    expect(
      parseDashboardQuickAccessSnapshot(
        createDefaultDashboardQuickAccessSnapshot(
          scope,
          "2026-07-14T10:00:00.000Z",
        ),
      ),
    ).not.toBeNull();
  });

  it("trims labels and enforces strict objects and label bounds", () => {
    expect(
      parseDashboardQuickAccessConfig({
        ...createDefaultDashboardQuickAccessConfig(),
        buttonLabel: "  Open agenda  ",
      })?.buttonLabel,
    ).toBe("Open agenda");
    expect(
      parseDashboardQuickAccessConfig({
        ...createDefaultDashboardQuickAccessConfig(),
        extra: true,
      }),
    ).toBeNull();
    expect(
      parseDashboardQuickAccessConfig({
        ...createDefaultDashboardQuickAccessConfig(),
        buttonLabel: "   ",
      }),
    ).toBeNull();
    expect(
      parseDashboardQuickAccessConfig({
        ...createDefaultDashboardQuickAccessConfig(),
        buttonLabel: "x".repeat(41),
      }),
    ).toBeNull();
  });

  it("rejects duplicate secondary actions and the primary as a secondary", () => {
    const defaults = createDefaultDashboardQuickAccessConfig();
    expect(
      parseDashboardQuickAccessConfig({
        ...defaults,
        secondaryActionIds: ["dashboard.home.open", "dashboard.home.open"],
      }),
    ).toBeNull();
    expect(
      parseDashboardQuickAccessConfig({
        ...defaults,
        secondaryActionIds: [defaults.primaryActionId],
      }),
    ).toBeNull();
  });
});
