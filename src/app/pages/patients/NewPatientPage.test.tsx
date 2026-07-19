import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { patientFormProps, newPatientWizardProps } = vi.hoisted(() => ({
  patientFormProps: [] as Array<{
    mode: "create" | "edit";
    onCreated?: (patient: { id: { toString: () => string } }) => void;
  }>,
  newPatientWizardProps: [] as Array<{
    onCreated?: (patient: { id: { toString: () => string } }) => void;
  }>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@app/layout/AppLayout", () => ({
  PageHeader: () => null,
  PageContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@components/ui/button", () => ({
  Button: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@modules/patient/ui/usePatientHooks", () => ({
  usePatient: () => ({ data: null, loading: false }),
}));

vi.mock("@modules/patient/ui/PatientForm", () => ({
  PatientFormSkeleton: () => null,
  PatientForm: (props: (typeof patientFormProps)[number]) => {
    patientFormProps.push(props);
    return <div>Legacy patient form</div>;
  },
}));

vi.mock("@modules/patient/ui/NewPatientWizard", () => ({
  NewPatientWizard: (props: (typeof newPatientWizardProps)[number]) => {
    newPatientWizardProps.push(props);
    return (
      <button
        type="button"
        onClick={() =>
          props.onCreated?.({ id: { toString: () => "patient-123" } })
        }
      >
        Complete creation
      </button>
    );
  },
}));

import { NewPatientPage } from "./NewPatientPage";

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname + location.search}
    </output>
  );
}

function renderPage(initialEntry: string) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Routes>
        <Route path="/pacientes/nuevo" element={<NewPatientPage />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("NewPatientPage quick consultation return", () => {
  beforeEach(() => {
    patientFormProps.length = 0;
    newPatientWizardProps.length = 0;
  });

  it("returns to quick consultation with the created patient ID", () => {
    renderPage("/pacientes/nuevo?returnTo=quick-consultation");

    fireEvent.click(screen.getByRole("button", { name: "Complete creation" }));

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/?quickConsultation=1&patientId=patient-123",
    );
  });

  it("keeps the normal creation flow when returnTo is absent", () => {
    renderPage("/pacientes/nuevo");

    expect(newPatientWizardProps.at(-1)?.onCreated).toBeUndefined();
    expect(patientFormProps).toHaveLength(0);
  });
});
