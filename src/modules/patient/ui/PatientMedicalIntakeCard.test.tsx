import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PatientMedicalIntake } from "@modules/patient/domain/Patient";
import { PatientMedicalIntakeCard } from "./PatientMedicalIntakeCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; number?: number }) => {
      const value = options?.number ?? options?.count;
      return value === undefined ? key : `${key} ${value}`;
    },
  }),
}));

function createIntake(
  overrides: Partial<PatientMedicalIntake> = {},
): PatientMedicalIntake {
  return {
    diagnosedConditions: null,
    previousSurgeries: null,
    currentTreatments: null,
    intolerances: null,
    diagnosedConditionDetails: [],
    previousSurgeryDetails: [],
    currentTreatmentDetails: [],
    intoleranceDetails: [],
    familyHistory: null,
    familyHistoryMode: null,
    familyHistoryDetails: null,
    medications: null,
    supplements: null,
    medicationAllergies: null,
    adverseMedicationOrSupplementEffects: null,
    supplementDetails: [],
    medicationAllergyDetails: [],
    dailyMedicationDetails: [],
    adverseEffectDetails: null,
    nutritionIntake: null,
    physicalActivity: null,
    physicalActivityIntake: null,
    ...overrides,
  };
}

describe("PatientMedicalIntakeCard", () => {
  it("renders personal, family, medication, supplement, allergy, and adverse-effect details", () => {
    render(
      <PatientMedicalIntakeCard
        intake={createIntake({
          diagnosedConditions: true,
          previousSurgeries: true,
          currentTreatments: true,
          intolerances: true,
          diagnosedConditionDetails: [
            {
              diagnosis: "Diabetes tipo 2",
              diagnosisYear: 2018,
              status: "controlled",
              treatment: "Metformina y alimentación",
            },
          ],
          previousSurgeryDetails: [
            {
              procedure: "Apendicectomía",
              year: 2010,
              reason: "Apendicitis aguda",
            },
          ],
          currentTreatmentDetails: [
            {
              name: "Fisioterapia lumbar",
              reason: "Dolor lumbar",
              frequency: "Dos veces por semana",
              professional: "Dra. Vega",
            },
          ],
          intoleranceDetails: [
            {
              substance: "Lactosa",
              reaction: "Distensión abdominal",
              severity: "moderate",
            },
          ],
          familyHistory: true,
          familyHistoryMode: "recorded",
          familyHistoryDetails: {
            diabetes: ["mother"],
            hypertension: ["father"],
            obesity: ["siblings"],
            cardiovascularDisease: ["paternalGrandparents"],
            dyslipidemia: ["none"],
            kidneyDisease: ["maternalGrandparents"],
            thyroidDisease: ["mother"],
            otherConditions: "Cáncer de colon en tío",
            notes: "Diagnósticos posteriores a los 50 años",
          },
          medications: true,
          supplements: true,
          medicationAllergies: true,
          adverseMedicationOrSupplementEffects: true,
          dailyMedicationDetails: [
            {
              name: "Losartán",
              dose: "50 mg",
              frequency: "daily",
              schedule: "08:00",
              reason: "Hipertensión",
              prescribedByProfessional: false,
            },
          ],
          supplementDetails: [
            {
              name: "Omega 3",
              dose: "1000 mg",
              frequency: "twiceDaily",
              objective: "Salud cardiovascular",
            },
          ],
          medicationAllergyDetails: [
            {
              medication: "Amoxicilina",
              reaction: "Urticaria",
              severity: "severe",
              requiredMedicalAttention: false,
            },
          ],
          adverseEffectDetails: "Hierro oral: náusea intensa",
        })}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "patient.initial_screening_title" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Diabetes tipo 2")).toBeInTheDocument();
    expect(screen.getByText("Metformina y alimentación")).toBeInTheDocument();
    expect(screen.getByText("Apendicectomía")).toBeInTheDocument();
    expect(screen.getByText("Apendicitis aguda")).toBeInTheDocument();
    expect(screen.getByText("Fisioterapia lumbar")).toBeInTheDocument();
    expect(screen.getByText("Dra. Vega")).toBeInTheDocument();
    expect(screen.getByText("Lactosa")).toBeInTheDocument();
    expect(screen.getByText("Distensión abdominal")).toBeInTheDocument();
    expect(
      screen.getByText("patient.wizard.family_member_paternalGrandparents"),
    ).toBeInTheDocument();
    expect(screen.getByText("Cáncer de colon en tío")).toBeInTheDocument();
    expect(
      screen.getByText("Diagnósticos posteriores a los 50 años"),
    ).toBeInTheDocument();
    expect(screen.getByText("Losartán")).toBeInTheDocument();
    expect(screen.getByText("Omega 3")).toBeInTheDocument();
    expect(screen.getByText("Salud cardiovascular")).toBeInTheDocument();
    expect(screen.getByText("Amoxicilina")).toBeInTheDocument();
    expect(screen.getByText("Urticaria")).toBeInTheDocument();
    expect(screen.getByText("Hierro oral: náusea intensa")).toBeInTheDocument();

    const medication = screen.getByRole("article", {
      name: "patient.wizard.medication_number 1",
    });
    const allergy = screen.getByRole("article", {
      name: "patient.wizard.allergy_number 1",
    });
    expect(within(medication).getByText("common.no")).toBeInTheDocument();
    expect(within(allergy).getByText("common.no")).toBeInTheDocument();
  });

  it("renders every nutrition group with its details, booleans, and notes", () => {
    render(
      <PatientMedicalIntakeCard
        intake={createIntake({
          nutritionIntake: {
            routine: {
              breakfastTime: "07:30",
              mainMealTime: "14:00",
              dinnerTime: "20:30",
              snackTimes: ["11:00", "17:00"],
              mealsPerDay: 5,
              skipsMeals: false,
              mostSkippedMeal: null,
              scheduleVaries: true,
              scheduleVariation: "weekendsLater",
              mealDuration: "20To30",
            },
            patterns: {
              eatingOutFrequency: "oneToTwoPerWeek",
              snacksBetweenMeals: true,
              eatsLateAtNight: false,
              frequentCravings: true,
              cravingTime: "night",
              mealPreparer: "partner",
              primaryMealLocation: "home",
            },
            preferences: {
              usualDietType: "other",
              otherDietDescription: "Alimentación tradicional oaxaqueña",
              avoidsFoods: true,
              avoidedFoods: "Hígado",
              followsFoodRestrictions: true,
              foodRestrictionDetails: "Sin carne los viernes",
              hasFoodDiscomfort: true,
              discomfortFoods: "Frijoles enteros",
              specialPreference: "lowSodium",
              notes: "Prefiere preparaciones caseras",
            },
            hydration: {
              waterIntake: "oneAndHalfToTwoLiters",
              drinksWaterThroughoutDay: true,
              carriesWaterBottle: false,
              coffeeTeaFrequency: "onePerDay",
              sugaryDrinkFrequency: "oneToTwoPerWeek",
              consumesEnergyDrinks: false,
              otherBeverage: "infusions",
              alcoholFrequency: "monthlyOrLess",
              notes: "Aumenta agua cuando hace ejercicio",
            },
            digestive: {
              appetiteLevel: "variable",
              earlySatiety: true,
              hasDigestiveDiscomfort: true,
              symptoms: ["bloating", "other"],
              otherSymptomDescription: "Sensación de pesadez",
              symptomTiming: "afterMeals",
              notes: "Empeora con comidas abundantes",
            },
          },
        })}
      />,
    );

    const routine = screen.getByRole("region", {
      name: "patient.wizard.nutrition_routine_title",
    });
    expect(within(routine).getByText("07:30")).toBeInTheDocument();
    expect(within(routine).getByText("11:00, 17:00")).toBeInTheDocument();
    expect(within(routine).getByText("common.no")).toBeInTheDocument();
    expect(
      within(routine).getByText(
        "patient.wizard.nutrition_schedule_weekendsLater",
      ),
    ).toBeInTheDocument();

    const patterns = screen.getByRole("region", {
      name: "patient.wizard.nutrition_patterns_title",
    });
    expect(
      within(patterns).getByText(
        "patient.wizard.nutrition_eating_out_oneToTwoPerWeek",
      ),
    ).toBeInTheDocument();
    expect(
      within(patterns).getByText("patient.wizard.nutrition_craving_time_night"),
    ).toBeInTheDocument();
    expect(
      within(patterns).getByText("patient.wizard.nutrition_preparer_partner"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Alimentación tradicional oaxaqueña"),
    ).toBeInTheDocument();
    expect(screen.getByText("Hígado")).toBeInTheDocument();
    expect(screen.getByText("Sin carne los viernes")).toBeInTheDocument();
    expect(screen.getByText("Frijoles enteros")).toBeInTheDocument();
    expect(
      screen.getByText("Prefiere preparaciones caseras"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("patient.wizard.nutrition_water_oneAndHalfToTwoLiters"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Aumenta agua cuando hace ejercicio"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "patient.wizard.nutrition_symptom_bloating, patient.wizard.nutrition_symptom_other",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Sensación de pesadez")).toBeInTheDocument();
    expect(
      screen.getByText("Empeora con comidas abundantes"),
    ).toBeInTheDocument();
  });

  it("renders physical activity and daily activity, including limitations and notes", () => {
    render(
      <PatientMedicalIntakeCard
        intake={createIntake({
          physicalActivity: true,
          physicalActivityIntake: {
            activity: {
              level: "moderate",
              daysPerWeek: 4,
              sessionDurationMinutes: 45,
              activityTypes: ["walking", "gym"],
              primaryGoal: "health",
              hasPhysicalLimitation: true,
              physicalLimitationDetails: "Dolor de rodilla derecha",
              notes: "Evita saltos",
            },
            dailyActivity: {
              sedentaryTime: "sixToEight",
              usualTransportation: "publicTransport",
              usesStairsFrequently: false,
              activeBreakFrequency: "sometimes",
              routineType: "seated",
              notes: "Trabaja frente a computadora",
            },
          },
        })}
      />,
    );

    const physicalActivity = screen.getByRole("region", {
      name: "patient.wizard.physical_activity_section_title",
    });
    expect(
      within(physicalActivity).getByText(
        "patient.wizard.physical_activity_level_moderate",
      ),
    ).toBeInTheDocument();
    expect(
      within(physicalActivity).getByText(
        "patient.wizard.physical_activity_duration_option 45",
      ),
    ).toBeInTheDocument();
    expect(
      within(physicalActivity).getByText(
        "patient.wizard.physical_activity_type_walking, patient.wizard.physical_activity_type_gym",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Dolor de rodilla derecha")).toBeInTheDocument();
    expect(screen.getByText("Evita saltos")).toBeInTheDocument();

    const dailyActivity = screen.getByRole("region", {
      name: "patient.wizard.daily_activity_section_title",
    });
    expect(
      within(dailyActivity).getByText(
        "patient.wizard.daily_activity_sedentary_sixToEight",
      ),
    ).toBeInTheDocument();
    expect(
      within(dailyActivity).getByText(
        "patient.wizard.daily_activity_transport_publicTransport",
      ),
    ).toBeInTheDocument();
    expect(within(dailyActivity).getByText("common.no")).toBeInTheDocument();
    expect(
      screen.getByText("Trabaja frente a computadora"),
    ).toBeInTheDocument();
  });

  it("keeps an explicit negative answer visible", () => {
    render(
      <PatientMedicalIntakeCard
        intake={createIntake({ diagnosedConditions: false })}
      />,
    );

    const history = screen.getByRole("region", {
      name: "patient.wizard.pathological_history_title",
    });
    expect(within(history).getByText("common.no")).toBeInTheDocument();
    expect(
      screen.queryByText("patient.initial_screening_empty"),
    ).not.toBeInTheDocument();
  });
});
