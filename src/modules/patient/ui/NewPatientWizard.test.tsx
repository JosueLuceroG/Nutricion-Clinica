import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createPatient } = vi.hoisted(() => ({
  createPatient: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@hooks/useUnsavedChangesGuard", () => ({
  useUnsavedChangesGuard: () => ({ state: "unblocked" }),
}));

vi.mock("@components/layout/ConfirmDialog", () => ({
  ConfirmDialog: () => null,
}));

vi.mock("@services/patientService", () => ({
  patientService: {
    create: { execute: createPatient },
  },
}));

vi.mock("@store/authStore", () => ({
  useAuthStore: (
    selector: (state: {
      user: { id: string; nombreCompleto: string; rol: string };
    }) => unknown,
  ) =>
    selector({
      user: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        nombreCompleto: "Dra. Paula Méndez",
        rol: "nutriologa",
      },
    }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { NewPatientWizard } from "./NewPatientWizard";

function input(name: string): HTMLInputElement {
  const element = document.querySelector<HTMLInputElement>(`[name="${name}"]`);
  if (!element) throw new Error(`Missing field ${name}`);
  return element;
}

function answer(name: string, value: "yes" | "no") {
  const element = document.querySelector<HTMLInputElement>(
    `[name="${name}"][value="${value}"]`,
  );
  if (!element) throw new Error(`Missing answer ${name}:${value}`);
  fireEvent.click(element);
}

function selectFamilyMember(name: string, value: string) {
  const familyField = document.querySelector<HTMLElement>(
    `[data-family-field="${name}"]`,
  );
  if (!familyField) throw new Error(`Missing family field ${name}`);
  const trigger = familyField.querySelector<HTMLButtonElement>(
    ".nc-new-patient__familySelectTrigger",
  );
  if (!trigger) throw new Error(`Missing family trigger ${name}`);
  fireEvent.pointerDown(trigger);
  fireEvent.click(trigger);
  fireEvent.blur(trigger, { relatedTarget: null });
  const element = document.querySelector<HTMLInputElement>(
    `[data-family-field="${name}"] input[value="${value}"]`,
  );
  if (!element) throw new Error(`Missing family selection ${name}:${value}`);
  fireEvent.click(element);
}

async function nextStep(nextField: string) {
  const buttons = screen.getAllByRole("button", { name: "common.next" });
  fireEvent.click(buttons.at(-1)!);
  await waitFor(() =>
    expect(document.querySelector(`[name="${nextField}"]`)).toBeInTheDocument(),
  );
}

describe("NewPatientWizard", () => {
  beforeEach(() => {
    createPatient.mockReset();
  });

  it("creates a patient from the seven-step registration", async () => {
    const created = {
      id: { toString: () => "patient-123" },
      fullName: "Ana Rivera",
    };
    const onCreated = vi.fn();
    createPatient.mockResolvedValue(created);
    render(
      <MemoryRouter>
        <NewPatientWizard onCreated={onCreated} />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("patient.wizard.medical_history_short"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("patient.wizard.physical_activity_short"),
    ).toBeInTheDocument();
    expect(screen.getByText("patient.wizard.notes_short")).toBeInTheDocument();

    fireEvent.change(input("firstName"), { target: { value: "Ana" } });
    fireEvent.change(input("lastName"), { target: { value: "Rivera" } });
    fireEvent.change(input("age"), { target: { value: "34" } });
    fireEvent.change(document.querySelector('[name="sex"]')!, {
      target: { value: "female" },
    });
    fireEvent.change(input("occupation"), { target: { value: "Docente" } });
    await nextStep("phone");

    expect(
      document.querySelector(
        ".nc-new-patient__formCard .nc-new-patient__navigationCard",
      ),
    ).toBeInTheDocument();
    expect(
      input("secondaryPhone").closest(".nc-new-patient__field"),
    ).toHaveClass("nc-new-patient__field--full");
    const whatsappGroup = screen.getByRole("radiogroup", {
      name: "patient.wizard.whatsapp_question",
    });
    expect(whatsappGroup).toHaveAttribute("data-enabled", "true");

    fireEvent.change(input("phone"), { target: { value: "+52 55 1234 5678" } });
    fireEvent.change(input("email"), { target: { value: "ana@example.com" } });
    fireEvent.change(input("secondaryPhone"), {
      target: { value: "+52 55 8765 4321" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "common.no" }));
    expect(whatsappGroup).toHaveAttribute("data-enabled", "false");
    await nextStep("emergencyContactName");

    fireEvent.change(input("emergencyContactName"), {
      target: { value: "Luis Rivera" },
    });
    fireEvent.change(
      document.querySelector('[name="emergencyContactRelationship"]')!,
      { target: { value: "Madre" } },
    );
    fireEvent.change(input("emergencyContactPhone"), {
      target: { value: "+52 55 2468 1357" },
    });
    await nextStep("externalRecordNumber");

    fireEvent.change(input("externalRecordNumber"), {
      target: { value: "EXT-42" },
    });
    fireEvent.change(document.querySelector('[name="admissionReason"]')!, {
      target: { value: "Primera valoración nutricional" },
    });
    await nextStep("diagnosedConditions");

    answer("diagnosedConditions", "yes");
    answer("previousSurgeries", "no");
    answer("currentTreatments", "yes");
    answer("intolerances", "no");
    await nextStep("familyDiabetes");

    selectFamilyMember("familyDiabetes", "mother");
    expect(
      document.querySelector(
        '[data-family-field="familyDiabetes"] input[type="checkbox"][value="mother"]',
      ),
    ).toBeChecked();
    expect(
      document.querySelector(
        '[data-family-field="familyDiabetes"] .nc-new-patient__familySelectTrigger',
      ),
    ).toHaveAttribute("aria-expanded", "true");
    for (const field of [
      "familyHypertension",
      "familyObesity",
      "familyCardiovascular",
      "familyDyslipidemia",
      "familyKidneyDisease",
      "familyThyroidDisease",
    ]) {
      selectFamilyMember(field, "none");
    }
    fireEvent.change(input("familyOtherConditions"), {
      target: { value: "Cardiopatía congénita" },
    });
    fireEvent.change(document.querySelector('[name="familyHistoryNotes"]')!, {
      target: { value: "Madre diagnosticada a los 52 años" },
    });
    await nextStep("supplements");

    answer("supplements", "no");
    answer("medicationAllergies", "yes");
    answer("medications", "yes");
    answer("adverseMedicationOrSupplementEffects", "no");
    await nextStep("physicalActivity");

    answer("physicalActivity", "yes");
    await nextStep("clinicalTags");

    fireEvent.change(input("clinicalTags"), {
      target: { value: "diabetes, hypertension" },
    });
    fireEvent.change(document.querySelector('[name="generalNotes"]')!, {
      target: { value: "Primera valoracion" },
    });

    const createButtons = screen.getAllByRole("button", {
      name: "patient.wizard.create_action",
    });
    fireEvent.click(createButtons.at(-1)!);

    await waitFor(() => expect(createPatient).toHaveBeenCalledTimes(1));
    const payload = createPatient.mock.calls[0][0];
    const today = new Date();
    expect(payload).toMatchObject({
      firstName: "Ana",
      lastName: "Rivera",
      sex: "female",
      occupation: "Docente",
      whatsappEnabled: false,
      clinicalTags: ["diabetes", "hypertension"],
      generalNotes: "Primera valoracion",
      responsibleProfessionalId: "550e8400-e29b-41d4-a716-446655440000",
      externalRecordNumber: "EXT-42",
      admissionReason: "Primera valoración nutricional",
      medicalIntake: {
        diagnosedConditions: true,
        previousSurgeries: false,
        currentTreatments: true,
        intolerances: false,
        familyHistory: true,
        familyHistoryDetails: {
          diabetes: ["mother"],
          hypertension: ["none"],
          obesity: ["none"],
          cardiovascularDisease: ["none"],
          dyslipidemia: ["none"],
          kidneyDisease: ["none"],
          thyroidDisease: ["none"],
          otherConditions: "Cardiopatía congénita",
          notes: "Madre diagnosticada a los 52 años",
        },
        medications: true,
        supplements: false,
        medicationAllergies: true,
        adverseMedicationOrSupplementEffects: false,
        physicalActivity: true,
      },
      emergencyContactName: "Luis Rivera",
      emergencyContactRelationship: "Madre",
    });
    expect(payload.birthDate).toBeInstanceOf(Date);
    expect(payload.birthDate.getFullYear()).toBe(today.getFullYear() - 34);
    expect(payload.phone.toString()).toBe("+52 55 1234 5678");
    expect(payload.secondaryPhone.toString()).toBe("+52 55 8765 4321");
    expect(payload.emergencyContactPhone.toString()).toBe("+52 55 2468 1357");
    expect(payload.email.toString()).toBe("ana@example.com");
    expect(onCreated).toHaveBeenCalledWith(created);
  });
});
