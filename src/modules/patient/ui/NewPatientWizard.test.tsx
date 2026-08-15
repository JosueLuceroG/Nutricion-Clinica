import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BirthDateFormSchema,
  parseBirthDateForPersistence,
} from "../application/patientFormSchema";
import { DEFAULT_PATIENT_RECORD_NUMBER_CONFIG } from "../application/patientRecordNumber";
import {
  PATIENT_REGISTRATION_DRAFT_KEY,
  readPatientRegistrationDraft,
  savePatientRegistrationDraft,
} from "../application/patientRegistrationDraft";
import { usePreferencesStore } from "@store/preferencesStore";

const { createPatient } = vi.hoisted(() => ({
  createPatient: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "es-MX" },
  }),
}));

vi.mock("@hooks/useUnsavedChangesGuard", () => ({
  useUnsavedChangesGuard: () => ({ state: "unblocked" }),
}));

vi.mock("@components/layout/ConfirmDialog", () => ({
  ConfirmDialog: ({
    open,
    title,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onOpenChange,
  }: {
    open: boolean;
    title: string;
    confirmLabel: string;
    cancelLabel: string;
    onConfirm: () => void;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <button type="button" onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </button>
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
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
      sucursalActivaId: null;
    }) => unknown,
  ) =>
    selector({
      user: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        nombreCompleto: "Dra. Paula Méndez",
        rol: "nutriologa",
      },
      sucursalActivaId: null,
    }),
}));

import { NewPatientWizard } from "./NewPatientWizard";
import { PatientForm } from "./PatientForm";

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
    localStorage.clear();
    usePreferencesStore.setState({
      patientRecordNumberConfig: DEFAULT_PATIENT_RECORD_NUMBER_CONFIG,
      patientRecordNumberNextSequence: 1,
    });
  });

  it("creates a patient from the eight-step registration", async () => {
    const created = {
      id: { toString: () => "patient-123" },
      fullName: "Ana Rivera",
    };
    const onCreated = vi.fn();
    let resolveCreate!: (value: typeof created) => void;
    createPatient.mockReturnValue(
      new Promise<typeof created>((resolve) => {
        resolveCreate = resolve;
      }),
    );
    savePatientRegistrationDraft({
      scope: {
        userId: "550e8400-e29b-41d4-a716-446655440000",
        sucursalId: null,
      },
      values: { firstName: "Paciente anterior" },
      navigation: {
        step: 0,
        medicalSection: "personal",
        nutritionSection: "routine",
        physicalActivitySection: "activity",
      },
      photoNeedsReselection: false,
    });
    render(
      <MemoryRouter>
        <NewPatientWizard onCreated={onCreated} />
      </MemoryRouter>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "patient.wizard.draft_continue" }),
    );

    expect(
      screen.getByText("patient.wizard.medical_history_short"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("patient.wizard.physical_activity_short"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("patient.wizard.nutrition_short"),
    ).toBeInTheDocument();
    expect(screen.getByText("patient.wizard.notes_short")).toBeInTheDocument();

    fireEvent.change(input("firstName"), { target: { value: "Ana" } });
    fireEvent.change(input("lastName"), { target: { value: "Rivera" } });
    fireEvent.change(input("birthDate"), {
      target: { value: "1991-04-09" },
    });
    expect(screen.getByText("patient.age_value")).toBeInTheDocument();
    fireEvent.change(document.querySelector('[name="sex"]')!, {
      target: { value: "female" },
    });
    expect(
      Array.from(
        document.querySelectorAll<HTMLSelectElement>('[name="sex"] option'),
      ).map((option) => option.value),
    ).toEqual(["", "female", "male"]);
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
    await nextStep("externalRecordNumber");

    expect(input("externalRecordNumber")).toHaveAttribute("readonly");
    fireEvent.change(document.querySelector('[name="admissionReason"]')!, {
      target: { value: "Primera valoración nutricional" },
    });
    await nextStep("diagnosedConditions");

    answer("diagnosedConditions", "yes");
    answer("previousSurgeries", "no");
    answer("currentTreatments", "yes");
    answer("intolerances", "no");
    fireEvent.click(
      screen.getAllByRole("button", { name: "common.next" }).at(-1)!,
    );
    await waitFor(() =>
      expect(screen.getAllByText("Completa este dato")).toHaveLength(5),
    );
    expect(
      document.querySelector('[name="familyDiabetes"]'),
    ).not.toBeInTheDocument();
    fireEvent.change(input("diagnosedConditionDetails.0.diagnosis"), {
      target: { value: "Diabetes mellitus tipo 2" },
    });
    fireEvent.change(input("diagnosedConditionDetails.0.status"), {
      target: { value: "controlled" },
    });
    fireEvent.change(input("currentTreatmentDetails.0.name"), {
      target: { value: "Terapia nutricional" },
    });
    fireEvent.change(input("currentTreatmentDetails.0.reason"), {
      target: { value: "Control glucémico" },
    });
    fireEvent.change(input("currentTreatmentDetails.0.frequency"), {
      target: { value: "Mensual" },
    });
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", {
          name: "patient.wizard.hide_medical_details",
        }),
      ).toHaveLength(2),
    );
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "patient.wizard.hide_medical_details",
      })[0]!,
    );
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "patient.wizard.hide_medical_details",
      })[0]!,
    );
    await nextStep("familyHistoryMode");
    fireEvent.click(
      document.querySelector('[name="familyHistoryMode"][value="recorded"]')!,
    );

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

    answer("supplements", "yes");
    answer("medicationAllergies", "yes");
    answer("medications", "yes");
    answer("adverseMedicationOrSupplementEffects", "no");
    expect(
      screen.getAllByRole("button", {
        name: "patient.wizard.hide_medical_details",
      }),
    ).toHaveLength(3);
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "patient.wizard.hide_medical_details",
      })[0]!,
    );
    expect(
      screen.getByText("patient.wizard.medical_details_pending"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "patient.wizard.show_medical_details",
      }),
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "common.next" }).at(-1)!,
    );
    await waitFor(() =>
      expect(screen.getAllByText("Completa este dato")).toHaveLength(14),
    );
    expect(
      document.querySelector('[name="activityLevel"]'),
    ).not.toBeInTheDocument();

    fireEvent.change(input("supplementDetails.0.name"), {
      target: { value: "Omega 3" },
    });
    fireEvent.change(input("supplementDetails.0.dose"), {
      target: { value: "1000 mg" },
    });
    fireEvent.change(input("supplementDetails.0.frequency"), {
      target: { value: "daily" },
    });
    fireEvent.change(input("supplementDetails.0.objective"), {
      target: { value: "Salud cardiovascular" },
    });
    fireEvent.change(input("medicationAllergyDetails.0.medication"), {
      target: { value: "Penicilina" },
    });
    fireEvent.change(input("medicationAllergyDetails.0.reaction"), {
      target: { value: "Urticaria" },
    });
    fireEvent.click(
      document.querySelector(
        '[name="medicationAllergyDetails.0.severity"][value="moderate"]',
      )!,
    );
    answer("medicationAllergyDetails.0.requiredMedicalAttention", "yes");
    fireEvent.change(input("dailyMedicationDetails.0.name"), {
      target: { value: "Metformina" },
    });
    fireEvent.change(input("dailyMedicationDetails.0.dose"), {
      target: { value: "850 mg" },
    });
    fireEvent.change(input("dailyMedicationDetails.0.frequency"), {
      target: { value: "twiceDaily" },
    });
    fireEvent.change(input("dailyMedicationDetails.0.schedule"), {
      target: { value: "08:00" },
    });
    fireEvent.change(input("dailyMedicationDetails.0.reason"), {
      target: { value: "Diabetes" },
    });
    answer("dailyMedicationDetails.0.prescribedByProfessional", "yes");
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", {
          name: "patient.wizard.hide_medical_details",
        }),
      ).toHaveLength(3),
    );
    for (let index = 0; index < 3; index += 1) {
      fireEvent.click(
        screen.getAllByRole("button", {
          name: "patient.wizard.hide_medical_details",
        })[0]!,
      );
    }
    expect(
      document.querySelector('[name="supplementDetails.0.name"]'),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector('[name="medicationAllergyDetails.0.medication"]'),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector('[name="dailyMedicationDetails.0.name"]'),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", {
        name: "patient.wizard.show_medical_details",
      }),
    ).toHaveLength(3);

    fireEvent.click(
      screen.getByRole("button", {
        name: /patient.wizard.family_history_title/,
      }),
    );
    expect(
      document.querySelector('[name="familyDiabetes"]'),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: /patient.wizard.medications_supplements_title/,
      }),
    );
    expect(
      screen.getAllByRole("button", {
        name: "patient.wizard.show_medical_details",
      }),
    ).toHaveLength(3);
    expect(
      document.querySelector('[name="supplementDetails.0.name"]'),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole("button", { name: "common.next" }).at(-1)!,
    );
    expect(
      await screen.findByText("patient.wizard.optional_medical_info_title"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("patient.wizard.optional_condition_year"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "patient.wizard.optional_medical_info_fill",
      }),
    );
    await waitFor(() =>
      expect(
        document.querySelector(
          '[name="diagnosedConditionDetails.0.diagnosisYear"]',
        ),
      ).toBeInTheDocument(),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /patient.wizard.medications_supplements_title/,
      }),
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "common.next" }).at(-1)!,
    );
    expect(
      await screen.findByText("patient.wizard.optional_medical_info_title"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "patient.wizard.optional_medical_info_skip",
      }),
    );
    await waitFor(() =>
      expect(
        document.querySelector('[name="breakfastTime"]'),
      ).toBeInTheDocument(),
    );

    fireEvent.change(input("breakfastTime"), { target: { value: "08:00" } });
    fireEvent.change(input("mainMealTime"), { target: { value: "13:30" } });
    fireEvent.change(input("dinnerTime"), { target: { value: "20:00" } });
    fireEvent.change(input("snackTimes.0.time"), {
      target: { value: "10:30" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "patient.wizard.nutrition_add_snack",
      }),
    );
    fireEvent.change(input("snackTimes.1.time"), {
      target: { value: "17:00" },
    });
    fireEvent.change(document.querySelector('[name="mealsPerDay"]')!, {
      target: { value: "5" },
    });
    expect(
      document.querySelector('[name="mostSkippedMeal"]'),
    ).not.toBeInTheDocument();
    answer("skipsMeals", "yes");
    fireEvent.change(document.querySelector('[name="mostSkippedMeal"]')!, {
      target: { value: "breakfast" },
    });
    expect(
      document.querySelector('[name="scheduleVariation"]'),
    ).not.toBeInTheDocument();
    answer("scheduleVaries", "yes");
    fireEvent.change(document.querySelector('[name="scheduleVariation"]')!, {
      target: { value: "weekendsLater" },
    });
    fireEvent.change(document.querySelector('[name="mealDuration"]')!, {
      target: { value: "20To30" },
    });
    await nextStep("eatingOutFrequency");
    fireEvent.change(document.querySelector('[name="eatingOutFrequency"]')!, {
      target: { value: "oneToTwoPerWeek" },
    });
    answer("snacksBetweenMeals", "yes");
    answer("eatsLateAtNight", "no");
    expect(
      document.querySelector('[name="cravingTime"]'),
    ).not.toBeInTheDocument();
    answer("frequentCravings", "yes");
    fireEvent.change(document.querySelector('[name="cravingTime"]')!, {
      target: { value: "afternoon" },
    });
    fireEvent.change(document.querySelector('[name="mealPreparer"]')!, {
      target: { value: "self" },
    });
    fireEvent.change(document.querySelector('[name="primaryMealLocation"]')!, {
      target: { value: "home" },
    });
    await nextStep("usualDietType");
    expect(
      document.querySelectorAll(
        ".nc-new-patient__nutritionPreferences legend > span",
      ),
    ).toHaveLength(0);
    expect(
      document.querySelector('[name="otherDietDescription"]'),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector('[name="avoidedFoods"]'),
    ).not.toBeInTheDocument();
    fireEvent.change(document.querySelector('[name="usualDietType"]')!, {
      target: { value: "other" },
    });
    fireEvent.change(input("otherDietDescription"), {
      target: { value: "Flexitariana" },
    });
    answer("avoidsFoods", "yes");
    fireEvent.change(document.querySelector('[name="avoidedFoods"]')!, {
      target: { value: "Mariscos" },
    });
    expect(
      document.querySelector('[name="foodRestrictionDetails"]'),
    ).not.toBeInTheDocument();
    answer("followsFoodRestrictions", "yes");
    fireEvent.change(input("foodRestrictionDetails"), {
      target: { value: "Sin carne roja" },
    });
    expect(
      document.querySelector('[name="discomfortFoods"]'),
    ).not.toBeInTheDocument();
    answer("hasFoodDiscomfort", "yes");
    fireEvent.change(document.querySelector('[name="discomfortFoods"]')!, {
      target: { value: "Lácteos" },
    });
    fireEvent.change(
      document.querySelector('[name="specialEatingPreference"]')!,
      { target: { value: "lowSodium" } },
    );
    fireEvent.change(document.querySelector('[name="foodPreferenceNotes"]')!, {
      target: { value: "Prefiere preparaciones caseras" },
    });
    await nextStep("waterIntake");
    fireEvent.change(document.querySelector('[name="waterIntake"]')!, {
      target: { value: "oneAndHalfToTwoLiters" },
    });
    answer("drinksWaterThroughoutDay", "yes");
    answer("carriesWaterBottle", "yes");
    fireEvent.change(document.querySelector('[name="coffeeTeaFrequency"]')!, {
      target: { value: "oneToTwoPerDay" },
    });
    fireEvent.change(document.querySelector('[name="sugaryDrinkFrequency"]')!, {
      target: { value: "oneToTwoPerWeek" },
    });
    answer("consumesEnergyDrinks", "no");
    fireEvent.change(document.querySelector('[name="otherBeverage"]')!, {
      target: { value: "infusions" },
    });
    fireEvent.change(document.querySelector('[name="alcoholFrequency"]')!, {
      target: { value: "never" },
    });
    fireEvent.change(document.querySelector('[name="hydrationNotes"]')!, {
      target: { value: "Toma agua con limón" },
    });
    await nextStep("appetiteLevel");
    fireEvent.click(
      document.querySelector('[name="appetiteLevel"][value="normal"]')!,
    );
    answer("earlySatiety", "no");
    expect(
      document.querySelector('[name="symptomTiming"]'),
    ).not.toBeInTheDocument();
    answer("hasDigestiveDiscomfort", "yes");
    expect(
      document.querySelector('[name="otherDigestiveSymptom"]'),
    ).not.toBeInTheDocument();
    for (const symptom of [
      "reflux",
      "gas",
      "abdominalPain",
      "heartburn",
      "vomiting",
      "belching",
      "abdominalCramps",
      "other",
    ]) {
      fireEvent.click(
        document.querySelector(
          `[name="digestiveSymptoms"][value="${symptom}"]`,
        )!,
      );
    }
    fireEvent.change(input("otherDigestiveSymptom"), {
      target: { value: "Sensación de vacío" },
    });
    fireEvent.change(document.querySelector('[name="symptomTiming"]')!, {
      target: { value: "afterMeals" },
    });
    fireEvent.change(document.querySelector('[name="digestiveNotes"]')!, {
      target: { value: "Más frecuente con comidas abundantes" },
    });
    await nextStep("activityLevel");
    expect(
      screen.getByText("patient.wizard.daily_activity_section_title"),
    ).toBeInTheDocument();
    fireEvent.click(
      document.querySelector('[name="activityLevel"][value="moderate"]')!,
    );
    fireEvent.change(document.querySelector('[name="activityDaysPerWeek"]')!, {
      target: { value: "3" },
    });
    fireEvent.change(
      document.querySelector('[name="activitySessionDuration"]')!,
      { target: { value: "45" } },
    );
    fireEvent.click(
      document.querySelector('[name="activityTypes"][value="walking"]')!,
    );
    fireEvent.click(
      document.querySelector('[name="activityTypes"][value="gym"]')!,
    );
    fireEvent.change(document.querySelector('[name="physicalActivityGoal"]')!, {
      target: { value: "health" },
    });
    answer("hasPhysicalLimitation", "yes");
    fireEvent.change(input("physicalLimitationDetails"), {
      target: { value: "Dolor leve de rodilla" },
    });
    fireEvent.change(
      document.querySelector('[name="physicalActivityNotes"]')!,
      {
        target: { value: "Prefiere entrenar por la mañana" },
      },
    );
    await nextStep("sedentaryTime");

    fireEvent.click(
      document.querySelector('[name="sedentaryTime"][value="sixToEight"]')!,
    );
    fireEvent.click(
      document.querySelector('[name="usualTransportation"][value="walking"]')!,
    );
    answer("usesStairsFrequently", "yes");
    fireEvent.click(
      document.querySelector(
        '[name="activeBreakFrequency"][value="frequently"]',
      )!,
    );
    fireEvent.click(
      document.querySelector('[name="dailyRoutineType"][value="mixed"]')!,
    );
    fireEvent.change(document.querySelector('[name="dailyActivityNotes"]')!, {
      target: { value: "Trabajo de oficina y caminata vespertina" },
    });
    await nextStep("generalNotes");

    expect(
      screen.getByText("patient.wizard.notes_observations_title"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("patient.wizard.notes_guide_title"),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[name="clinicalTags"]'),
    ).not.toBeInTheDocument();
    fireEvent.change(document.querySelector('[name="generalNotes"]')!, {
      target: { value: "Primera valoracion" },
    });

    const createButtons = screen.getAllByRole("button", {
      name: "patient.wizard.create_action",
    });
    fireEvent.click(createButtons.at(-1)!);

    const reviewDialog = await screen.findByTestId(
      "final-registration-review-dialog",
    );
    expect(
      reviewDialog.querySelector('[data-review-section="required"]'),
    ).not.toBeInTheDocument();
    expect(
      reviewDialog.querySelector('[data-review-section="optional"]'),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "patient.wizard.final_review_save_anyway",
      }),
    );
    expect(
      await screen.findByText("patient.wizard.saving_patient"),
    ).toBeInTheDocument();
    resolveCreate(created);

    await waitFor(() => expect(createPatient).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByTestId("patient-created-transition"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("patient.wizard.creation_success_title"),
    ).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
    const payload = createPatient.mock.calls[0][0];
    const today = new Date();
    expect(payload).toMatchObject({
      firstName: "Ana",
      lastName: "Rivera",
      sex: "female",
      occupation: "Docente",
      whatsappEnabled: false,
      clinicalTags: [],
      generalNotes: "Primera valoracion",
      responsibleProfessionalId: "550e8400-e29b-41d4-a716-446655440000",
      externalRecordNumber: `EXP-${String(today.getMonth() + 1).padStart(2, "0")}-ANR${String(today.getFullYear()).slice(-2)}01`,
      admissionReason: "Primera valoración nutricional",
      medicalIntake: {
        diagnosedConditions: true,
        previousSurgeries: false,
        currentTreatments: true,
        intolerances: false,
        diagnosedConditionDetails: [
          {
            diagnosis: "Diabetes mellitus tipo 2",
            diagnosisYear: null,
            status: "controlled",
            treatment: null,
          },
        ],
        previousSurgeryDetails: [],
        currentTreatmentDetails: [
          {
            name: "Terapia nutricional",
            reason: "Control glucémico",
            frequency: "Mensual",
            professional: null,
          },
        ],
        intoleranceDetails: [],
        familyHistory: true,
        familyHistoryMode: "recorded",
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
        supplements: true,
        medicationAllergies: true,
        adverseMedicationOrSupplementEffects: false,
        supplementDetails: [
          {
            name: "Omega 3",
            dose: "1000 mg",
            frequency: "daily",
            objective: "Salud cardiovascular",
          },
        ],
        medicationAllergyDetails: [
          {
            medication: "Penicilina",
            reaction: "Urticaria",
            severity: "moderate",
            requiredMedicalAttention: true,
          },
        ],
        dailyMedicationDetails: [
          {
            name: "Metformina",
            dose: "850 mg",
            frequency: "twiceDaily",
            schedule: "08:00",
            reason: "Diabetes",
            prescribedByProfessional: true,
          },
        ],
        adverseEffectDetails: null,
        nutritionIntake: {
          routine: {
            breakfastTime: "08:00",
            mainMealTime: "13:30",
            dinnerTime: "20:00",
            snackTimes: ["10:30", "17:00"],
            mealsPerDay: 5,
            skipsMeals: true,
            mostSkippedMeal: "breakfast",
            scheduleVaries: true,
            scheduleVariation: "weekendsLater",
            mealDuration: "20To30",
          },
          patterns: {
            eatingOutFrequency: "oneToTwoPerWeek",
            snacksBetweenMeals: true,
            eatsLateAtNight: false,
            frequentCravings: true,
            cravingTime: "afternoon",
            mealPreparer: "self",
            primaryMealLocation: "home",
          },
          preferences: {
            usualDietType: "other",
            otherDietDescription: "Flexitariana",
            avoidsFoods: true,
            avoidedFoods: "Mariscos",
            followsFoodRestrictions: true,
            foodRestrictionDetails: "Sin carne roja",
            hasFoodDiscomfort: true,
            discomfortFoods: "Lácteos",
            specialPreference: "lowSodium",
            notes: "Prefiere preparaciones caseras",
          },
          hydration: {
            waterIntake: "oneAndHalfToTwoLiters",
            drinksWaterThroughoutDay: true,
            carriesWaterBottle: true,
            coffeeTeaFrequency: "oneToTwoPerDay",
            sugaryDrinkFrequency: "oneToTwoPerWeek",
            consumesEnergyDrinks: false,
            otherBeverage: "infusions",
            alcoholFrequency: "never",
            notes: "Toma agua con limón",
          },
          digestive: {
            appetiteLevel: "normal",
            earlySatiety: false,
            hasDigestiveDiscomfort: true,
            symptoms: [
              "reflux",
              "gas",
              "abdominalPain",
              "heartburn",
              "vomiting",
              "belching",
              "abdominalCramps",
              "other",
            ],
            otherSymptomDescription: "Sensación de vacío",
            symptomTiming: "afterMeals",
            notes: "Más frecuente con comidas abundantes",
          },
        },
        physicalActivity: true,
        physicalActivityIntake: {
          activity: {
            level: "moderate",
            daysPerWeek: 3,
            sessionDurationMinutes: 45,
            activityTypes: ["walking", "gym"],
            primaryGoal: "health",
            hasPhysicalLimitation: true,
            physicalLimitationDetails: "Dolor leve de rodilla",
            notes: "Prefiere entrenar por la mañana",
          },
          dailyActivity: {
            sedentaryTime: "sixToEight",
            usualTransportation: "walking",
            usesStairsFrequently: true,
            activeBreakFrequency: "frequently",
            routineType: "mixed",
            notes: "Trabajo de oficina y caminata vespertina",
          },
        },
      },
      emergencyContactName: "Luis Rivera",
      emergencyContactRelationship: "Madre",
    });
    expect(payload.birthDate).toBeInstanceOf(Date);
    expect(payload.birthDate.getFullYear()).toBe(1991);
    expect(payload.birthDate.getMonth()).toBe(3);
    expect(payload.birthDate.getDate()).toBe(9);
    expect(payload.birthDate.getHours()).toBe(12);
    expect(payload.phone.toString()).toBe("+52 55 1234 5678");
    expect(payload.secondaryPhone.toString()).toBe("+52 55 8765 4321");
    expect(payload.emergencyContactPhone).toBeNull();
    expect(payload.email.toString()).toBe("ana@example.com");
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created), {
      timeout: 5_000,
    });
    expect(localStorage.getItem(PATIENT_REGISTRATION_DRAFT_KEY)).toBeNull();
  }, 60_000);

  it("offers to continue the only draft at its last step", () => {
    savePatientRegistrationDraft({
      scope: {
        userId: "550e8400-e29b-41d4-a716-446655440000",
        sucursalId: null,
      },
      values: {
        firstName: "Elena",
        phone: "+52 55 1111 2222",
      },
      navigation: {
        step: 1,
        medicalSection: "family",
        nutritionSection: "hydration",
        physicalActivitySection: "daily",
      },
      photoNeedsReselection: true,
    });

    render(
      <MemoryRouter>
        <NewPatientWizard />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        name: "patient.wizard.draft_found_title",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("patient.wizard.draft_found_step"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("patient.wizard.draft_photo_reselection"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "patient.wizard.draft_continue" }),
    );
    expect(input("phone")).toHaveValue("+52 55 1111 2222");
    expect(
      screen.getByText("patient.wizard.draft_restored"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "patient.wizard.draft_found_title",
      }),
    ).not.toBeInTheDocument();
  });

  it("restores a legacy age-only draft without inventing a birth date", () => {
    savePatientRegistrationDraft({
      scope: {
        userId: "550e8400-e29b-41d4-a716-446655440000",
        sucursalId: null,
      },
      values: {
        firstName: "Elena",
        age: "34",
      },
      navigation: {
        step: 7,
        medicalSection: "medications",
        nutritionSection: "digestive",
        physicalActivitySection: "daily",
      },
      photoNeedsReselection: false,
    });

    const { unmount } = render(
      <MemoryRouter>
        <NewPatientWizard />
      </MemoryRouter>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "patient.wizard.draft_continue" }),
    );

    expect(input("firstName")).toHaveValue("Elena");
    expect(input("birthDate")).toHaveValue("");
    expect(document.querySelector('[name="age"]')).toBeNull();

    fireEvent.change(input("birthDate"), {
      target: { value: "1990-08-17" },
    });
    unmount();

    const migratedDraft = readPatientRegistrationDraft<Record<string, unknown>>(
      {
        userId: "550e8400-e29b-41d4-a716-446655440000",
        sucursalId: null,
      },
    );
    expect(migratedDraft?.values.birthDate).toBe("1990-08-17");
    expect(migratedDraft?.values).not.toHaveProperty("age");
  });

  it("requires an exact, non-future birth date from 1900 onward", async () => {
    render(
      <MemoryRouter>
        <NewPatientWizard />
      </MemoryRouter>,
    );
    fireEvent.change(input("firstName"), { target: { value: "Ana" } });
    fireEvent.change(input("lastName"), { target: { value: "Rivera" } });
    fireEvent.change(document.querySelector('[name="sex"]')!, {
      target: { value: "female" },
    });

    fireEvent.click(
      screen.getAllByRole("button", { name: "common.next" }).at(-1)!,
    );
    expect(await screen.findByText("Requerido")).toBeInTheDocument();

    const futureResult = BirthDateFormSchema.safeParse(
      `${new Date().getFullYear() + 1}-01-01`,
    );
    const tooOldResult = BirthDateFormSchema.safeParse("1899-12-31");
    const normalizedInvalidResult = BirthDateFormSchema.safeParse("2023-02-29");

    expect(futureResult.success).toBe(false);
    expect(tooOldResult.success).toBe(false);
    expect(normalizedInvalidResult.success).toBe(false);
    if (!futureResult.success) {
      expect(futureResult.error.issues[0]?.message).toBe(
        "La fecha de nacimiento no puede estar en el futuro",
      );
    }
    if (!tooOldResult.success) {
      expect(tooOldResult.error.issues[0]?.message).toBe(
        "La fecha de nacimiento no puede ser anterior a 1900",
      );
    }

    const morning = new Date(2026, 6, 30, 8, 15);
    const todayBirthDate = parseBirthDateForPersistence("2026-07-30", morning);
    expect(todayBirthDate?.getFullYear()).toBe(2026);
    expect(todayBirthDate?.getMonth()).toBe(6);
    expect(todayBirthDate?.getDate()).toBe(30);
    expect(todayBirthDate?.getHours()).toBe(8);
    expect(todayBirthDate?.getTime()).toBeLessThanOrEqual(morning.getTime());
  });

  it("requires confirmation before deleting a draft to start over", () => {
    savePatientRegistrationDraft({
      scope: {
        userId: "550e8400-e29b-41d4-a716-446655440000",
        sucursalId: null,
      },
      values: { firstName: "Elena", phone: "+52 55 1111 2222" },
      navigation: {
        step: 1,
        medicalSection: "personal",
        nutritionSection: "routine",
        physicalActivitySection: "activity",
      },
      photoNeedsReselection: false,
    });

    render(
      <MemoryRouter>
        <NewPatientWizard />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "patient.wizard.draft_start_new" }),
    );
    expect(
      screen.getByRole("dialog", {
        name: "patient.wizard.draft_discard_title",
      }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(PATIENT_REGISTRATION_DRAFT_KEY)).not.toBeNull();

    fireEvent.click(
      screen.getByRole("button", {
        name: "patient.wizard.draft_discard_cancel",
      }),
    );
    expect(
      screen.getByRole("heading", {
        name: "patient.wizard.draft_found_title",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "patient.wizard.draft_start_new" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "patient.wizard.draft_discard_confirm",
      }),
    );

    expect(localStorage.getItem(PATIENT_REGISTRATION_DRAFT_KEY)).toBeNull();
    expect(input("firstName")).toHaveValue("");
  });

  it("flushes the latest values on exit without storing generated fields", () => {
    const { unmount } = render(
      <MemoryRouter>
        <NewPatientWizard />
      </MemoryRouter>,
    );

    fireEvent.change(input("firstName"), { target: { value: "Marina" } });
    fireEvent.change(input("lastName"), { target: { value: "Santos" } });
    unmount();

    const draft = readPatientRegistrationDraft<Record<string, unknown>>({
      userId: "550e8400-e29b-41d4-a716-446655440000",
      sucursalId: null,
    });
    expect(draft?.values).toMatchObject({
      firstName: "Marina",
      lastName: "Santos",
    });
    expect(draft?.values).not.toHaveProperty("externalRecordNumber");
    expect(draft?.values).not.toHaveProperty("photoUrl");
  });

  it("summarizes required and optional fields before the final save", async () => {
    render(
      <MemoryRouter>
        <NewPatientWizard />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByText("patient.wizard.notes_short").closest("button")!,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "patient.wizard.create_action",
      }),
    );

    const reviewDialog = await screen.findByTestId(
      "final-registration-review-dialog",
    );
    expect(
      reviewDialog.querySelector('[data-review-section="required"]'),
    ).toBeInTheDocument();
    expect(
      reviewDialog.querySelector('[data-review-section="optional"]'),
    ).toBeInTheDocument();
    expect(createPatient).not.toHaveBeenCalled();
  });

  it("requires configuring the clinical record number before continuing", () => {
    usePreferencesStore.setState({ patientRecordNumberConfig: null });
    render(
      <MemoryRouter>
        <NewPatientWizard />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen
        .getByText("patient.wizard.clinical_record_short")
        .closest("button")!,
    );

    expect(
      screen.getByText("patient.wizard.record_number_configuration_required"),
    ).toBeInTheDocument();
    const configurationAlert = screen.getByRole("alert");
    expect(
      screen.getByRole("button", {
        name: "patient.wizard.record_number_configuration_action",
      }),
    ).toBeInTheDocument();
    expect(document.querySelector('[name="externalRecordNumber"]')).toBeNull();
    fireEvent.click(
      screen.getAllByRole("button", { name: "common.next" }).at(-1)!,
    );
    expect(configurationAlert).toHaveFocus();
  });

  it("parses PatientForm date-only values at local noon without a UTC shift", async () => {
    const created = {
      id: { toString: () => "patient-date-only" },
      fullName: "Luz Diaz",
    };
    const onCreated = vi.fn();
    createPatient.mockResolvedValue(created);
    render(
      <MemoryRouter>
        <PatientForm mode="create" onCreated={onCreated} />
      </MemoryRouter>,
    );

    fireEvent.change(input("firstName"), { target: { value: "Luz" } });
    fireEvent.change(input("lastName"), { target: { value: "Diaz" } });
    fireEvent.change(input("birthDate"), {
      target: { value: "2000-02-29" },
    });
    fireEvent.click(screen.getByRole("button", { name: "patient.create" }));

    await waitFor(() => expect(createPatient).toHaveBeenCalledTimes(1));
    const birthDate = createPatient.mock.calls[0][0].birthDate as Date;
    expect(birthDate.getFullYear()).toBe(2000);
    expect(birthDate.getMonth()).toBe(1);
    expect(birthDate.getDate()).toBe(29);
    expect(birthDate.getHours()).toBe(12);
    expect(onCreated).toHaveBeenCalledWith(created);
  });
});
