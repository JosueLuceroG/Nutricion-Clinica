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

  it("creates a patient from the eight-step registration", async () => {
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
    expect(
      screen.getByText("patient.wizard.nutrition_short"),
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
      document.querySelector('[name="physicalActivity"]'),
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
  }, 20_000);
});
