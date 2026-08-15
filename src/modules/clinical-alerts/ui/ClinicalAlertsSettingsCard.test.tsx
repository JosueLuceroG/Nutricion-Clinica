import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@store/authStore";
import { useClinicalAlertPreferencesStore } from "@store/clinicalAlertPreferencesStore";
import { ClinicalAlertsSettingsCard } from "./ClinicalAlertsSettingsCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("ClinicalAlertsSettingsCard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.setState({
      user: { id: "alert-settings-user" } as NonNullable<ReturnType<typeof useAuthStore.getState>["user"]>,
      sucursalActivaId: "alert-settings-branch",
    });
    useClinicalAlertPreferencesStore.getState().activateScope({
      userId: "alert-settings-user",
      sucursalId: "alert-settings-branch",
    });
  });

  it("updates individual rules and restores safe defaults", () => {
    render(<ClinicalAlertsSettingsCard />);

    const upcomingSwitch = screen.getByRole("switch", {
      name: "clinicalAlerts.upcoming_rule_title",
    });
    expect(upcomingSwitch).toBeChecked();
    fireEvent.click(upcomingSwitch);
    expect(useClinicalAlertPreferencesStore.getState().preferences.upcomingConsultation.enabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /clinicalAlerts\.restore_defaults/ }));
    expect(useClinicalAlertPreferencesStore.getState().preferences).toMatchObject({
      enabled: true,
      popupEnabled: true,
      upcomingConsultation: { enabled: true, lead: 10 },
    });
  });

  it("renders a focusable settings deep-link target", () => {
    render(<ClinicalAlertsSettingsCard />);
    const card = screen.getByTestId("clinical-alerts-settings");
    expect(card).toHaveAttribute("data-settings-section", "clinical-alerts");
    expect(card).toHaveAttribute("tabindex", "-1");
  });
});
