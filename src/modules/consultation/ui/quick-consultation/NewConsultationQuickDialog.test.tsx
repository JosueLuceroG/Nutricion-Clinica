import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { QuickConsultationPatient } from "../../application/quickConsultationTypes";

const patient: QuickConsultationPatient = {
  id: "018f0000-0000-7000-8000-000000000001",
  fullName: "María López",
  recordNumber: "00123",
  phone: "5551234567",
  email: "maria@example.com",
  photoUrl: null,
  initials: "ML",
  updatedAt: "2026-07-15T12:00:00.000Z",
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) => {
      if (!values) return key;
      return Object.entries(values).reduce(
        (text, [name, value]) => text.replace(`{{${name}}}`, String(value)),
        key,
      );
    },
    i18n: { language: "es-MX" },
  }),
}));

vi.mock("./useQuickConsultationPatients", () => ({
  useQuickConsultationPatients: () => ({
    patients: [patient],
    visiblePatients: [patient],
    loading: false,
    error: null,
    searching: false,
  }),
}));

vi.mock("./usePatientClinicalSummary", () => ({
  usePatientClinicalSummary: (patientId: string | null) => ({
    loading: false,
    error: null,
    summary: patientId
      ? {
          latestConsultation: null,
          activeGoal: null,
          activePlan: null,
          alerts: [],
          financial: { pendingCount: 0, pendingAmount: 0 },
          followUp: {
            scheduledDate: null,
            scheduledTime: null,
            recommendedDate: null,
          },
        }
      : null,
  }),
}));

import { NewConsultationQuickDialog } from "./NewConsultationQuickDialog";

describe("NewConsultationQuickDialog", () => {
  it("requires a patient and an action before continuing", () => {
    const onContinue = vi.fn();
    render(
      <NewConsultationQuickDialog
        open
        onOpenChange={vi.fn()}
        onRegisterPatient={vi.fn()}
        onContinue={onContinue}
      />,
    );

    const continueButton = screen.getByRole("button", {
      name: "quickConsultation.continue",
    });
    expect(continueButton).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", { name: /María López EXP-00123/ }),
    );
    expect(continueButton).toBeDisabled();

    fireEvent.click(
      screen.getByRole("radio", { name: /quickConsultation.startNow/ }),
    );
    expect(continueButton).toBeEnabled();

    fireEvent.click(continueButton);
    expect(onContinue).toHaveBeenCalledWith(patient, "start-now");
  });

  it("preselects a returned patient and exposes patient registration", () => {
    const onRegisterPatient = vi.fn();
    render(
      <NewConsultationQuickDialog
        open
        initialPatientId={patient.id}
        onOpenChange={vi.fn()}
        onRegisterPatient={onRegisterPatient}
        onContinue={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /María López EXP-00123/ }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(
      screen.getByRole("button", {
        name: "quickConsultation.registerPatient",
      }),
    );
    expect(onRegisterPatient).toHaveBeenCalledOnce();
  });
});
