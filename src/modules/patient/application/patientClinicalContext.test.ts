import { afterEach, describe, expect, it, vi } from "vitest";
import { Patient } from "../domain/Patient";
import {
  buildConsultationPrefill,
  toPatientClinicalContext,
  toPatientMealPlanClinicalContext,
} from "./patientClinicalContext";

afterEach(() => {
  vi.useRealTimers();
});

describe("patient clinical context", () => {
  it("derives a frozen rich clinical snapshot and consumer projections", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-28T12:00:00Z"));

    const patient = Patient.create({
      firstName: "Ana",
      lastName: "Torres",
      secondLastName: "López",
      birthDate: new Date("1990-05-15T00:00:00Z"),
      sex: "female",
      gender: "woman",
      maritalStatus: "married",
      occupation: "Docente",
      education: "postgraduate",
      admissionReason: "Primera valoración por control glucémico",
      generalNotes: "Seguimiento metabólico",
      clinicalTags: ["diabetes", "control trimestral"],
      medicalIntake: {
        diagnosedConditions: true,
        previousSurgeries: true,
        currentTreatments: true,
        familyHistory: true,
        medications: true,
        supplements: true,
        medicationAllergies: true,
        adverseMedicationOrSupplementEffects: true,
        intolerances: true,
        diagnosedConditionDetails: [
          {
            diagnosis: "Diabetes tipo 2",
            diagnosisYear: 2021,
            status: "controlled",
            treatment: "Metformina y nutrición",
          },
        ],
        previousSurgeryDetails: [
          {
            procedure: "Apendicectomía",
            year: 2008,
            reason: "Apendicitis aguda",
          },
        ],
        currentTreatmentDetails: [
          {
            name: "Terapia física",
            reason: "Dolor lumbar",
            frequency: "Semanal",
            professional: "Dra. Pérez",
          },
        ],
        dailyMedicationDetails: [
          {
            name: "Metformina",
            dose: "850 mg",
            frequency: "twiceDaily",
            schedule: "08:00 y 20:00",
            reason: "Diabetes",
            prescribedByProfessional: true,
          },
        ],
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
            severity: "severe",
            requiredMedicalAttention: true,
          },
        ],
        intoleranceDetails: [
          {
            substance: "Lactosa",
            reaction: "Distensión",
            severity: "moderate",
          },
        ],
        familyHistoryMode: "recorded",
        familyHistoryDetails: {
          diabetes: ["mother"],
          hypertension: ["father"],
          obesity: ["none"],
          cardiovascularDisease: ["maternalGrandparents"],
          dyslipidemia: ["siblings"],
          kidneyDisease: ["none"],
          thyroidDisease: ["none"],
          otherConditions: "Cardiopatía congénita",
          notes: "Diagnóstico antes de los 50 años",
        },
        adverseEffectDetails: "Náusea al tomar hierro en ayuno",
        nutritionIntake: {
          routine: {
            breakfastTime: "08:00",
            mainMealTime: "14:00",
            dinnerTime: "20:30",
            snackTimes: ["11:00", "17:00"],
            mealsPerDay: 5,
            skipsMeals: false,
            mostSkippedMeal: null,
            scheduleVaries: false,
            scheduleVariation: null,
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
            foodRestrictionDetails: "Sin lactosa añadida",
            hasFoodDiscomfort: true,
            discomfortFoods: "Lácteos",
            specialPreference: "lowSodium",
            notes: "Prefiere comida casera",
          },
          hydration: {
            waterIntake: "oneAndHalfToTwoLiters",
            drinksWaterThroughoutDay: true,
            carriesWaterBottle: true,
            coffeeTeaFrequency: "onePerDay",
            sugaryDrinkFrequency: "never",
            consumesEnergyDrinks: false,
            otherBeverage: "infusions",
            alcoholFrequency: "never",
            notes: "Aumentar agua en días cálidos",
          },
          digestive: {
            appetiteLevel: "normal",
            earlySatiety: false,
            hasDigestiveDiscomfort: true,
            symptoms: ["bloating", "reflux"],
            otherSymptomDescription: null,
            symptomTiming: "afterMeals",
            notes: "Empeora con lácteos",
          },
        },
        physicalActivityIntake: {
          activity: {
            level: "intense",
            daysPerWeek: 5,
            sessionDurationMinutes: 60,
            activityTypes: ["running"],
            primaryGoal: "health",
            hasPhysicalLimitation: true,
            physicalLimitationDetails: "Molestia de rodilla",
            notes: "Entrena por la mañana",
          },
          dailyActivity: {
            sedentaryTime: "sixToEight",
            usualTransportation: "mixed",
            usesStairsFrequently: true,
            activeBreakFrequency: "sometimes",
            routineType: "moving",
            notes: "Camina durante sus traslados",
          },
        },
      },
    });

    const context = toPatientClinicalContext(patient);

    expect(context).toMatchObject({
      fullName: "Ana Torres López",
      age: 36,
      sex: "female",
      gender: "woman",
      maritalStatus: "married",
      occupation: "Docente",
      education: "postgraduate",
      admissionReason: "Primera valoración por control glucémico",
      intakeResponses: {
        diagnosedConditions: true,
        previousSurgeries: true,
        currentTreatments: true,
        intolerances: true,
        familyHistory: true,
        medications: true,
        supplements: true,
        medicationAllergies: true,
        adverseMedicationOrSupplementEffects: true,
      },
      diagnoses: [
        {
          name: "Diabetes tipo 2",
          diagnosisYear: 2021,
          status: "controlled",
          treatment: "Metformina y nutrición",
        },
      ],
      previousSurgeries: [
        {
          procedure: "Apendicectomía",
          year: 2008,
          reason: "Apendicitis aguda",
        },
      ],
      treatments: [{ name: "Terapia física" }],
      medications: [{ name: "Metformina", dose: "850 mg" }],
      supplements: [{ name: "Omega 3" }],
      medicationAllergies: [{ medication: "Penicilina" }],
      intolerances: [{ substance: "Lactosa" }],
      familyHistoryMode: "recorded",
      familyHistoryDetails: {
        diabetes: ["mother"],
        hypertension: ["father"],
        cardiovascularDisease: ["maternalGrandparents"],
        otherConditions: "Cardiopatía congénita",
      },
      adverseEffectDetails: "Náusea al tomar hierro en ayuno",
      diet: {
        usualDietType: "other",
        specialPreference: "lowSodium",
        avoidedFoods: "Mariscos",
        foodRestrictionDetails: "Sin lactosa añadida",
        discomfortFoods: "Lácteos",
      },
      eatingPatterns: {
        eatingOutFrequency: "oneToTwoPerWeek",
        snacksBetweenMeals: true,
        frequentCravings: true,
        cravingTime: "afternoon",
      },
      mealsPerDay: 5,
      hydration: {
        waterIntake: "oneAndHalfToTwoLiters",
        notes: "Aumentar agua en días cálidos",
      },
      digestive: {
        symptoms: ["bloating", "reflux"],
        notes: "Empeora con lácteos",
      },
      physicalActivity: {
        reported: true,
        level: "intense",
        daysPerWeek: 5,
        activityLevelKey: "active",
        profile: {
          sessionDurationMinutes: 60,
          activityTypes: ["running"],
          primaryGoal: "health",
          hasPhysicalLimitation: true,
          physicalLimitationDetails: "Molestia de rodilla",
          notes: "Entrena por la mañana",
        },
        dailyActivity: {
          sedentaryTime: "sixToEight",
          usualTransportation: "mixed",
          usesStairsFrequently: true,
          activeBreakFrequency: "sometimes",
          routineType: "moving",
          notes: "Camina durante sus traslados",
        },
      },
      generalNotes: "Seguimiento metabólico",
      clinicalTags: ["diabetes", "control trimestral"],
    });
    expect(context.mealRoutine?.snackTimes).toEqual(["11:00", "17:00"]);

    const mealPlanContext = toPatientMealPlanClinicalContext(context);
    expect(mealPlanContext).toMatchObject({
      diagnosisNames: ["Diabetes tipo 2"],
      restrictions: ["Mariscos", "Sin lactosa añadida", "Lácteos", "Lactosa"],
      preferences: ["Flexitariana", "lowSodium", "Prefiere comida casera"],
    });
    expect(mealPlanContext.clinicalConsiderations).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Medicación: Metformina 850 mg"),
        expect.stringContaining("Alergias a medicamentos: Penicilina"),
        expect.stringContaining("Efectos adversos reportados: Náusea"),
        expect.stringContaining("Hidratación: agua oneAndHalfToTwoLiters"),
        expect.stringContaining("Digestivo: apetito normal"),
        expect.stringContaining("Patrones alimentarios: come fuera"),
        expect.stringContaining("Actividad física: intense, 5 días/semana"),
        expect.stringContaining("Actividad diaria: tiempo sedentario"),
      ]),
    );

    const prefill = buildConsultationPrefill(context);
    expect(prefill).toContain("Paciente: Ana Torres López | Edad: 36");
    expect(prefill).toContain(
      "Contexto sociodemográfico: género: woman; estado civil: married; ocupación: Docente; escolaridad: postgraduate",
    );
    expect(prefill).toContain("Motivo de ingreso: Primera valoración");
    expect(prefill).toContain("Diabetes tipo 2 (año: 2021; estado: controlled");
    expect(prefill).toContain(
      "Cirugías previas: Apendicectomía (año: 2008; motivo: Apendicitis aguda)",
    );
    expect(prefill).toContain("profesional: Dra. Pérez");
    expect(prefill).toContain(
      "motivo: Diabetes; prescrito por profesional: sí",
    );
    expect(prefill).toContain("objetivo: Salud cardiovascular");
    expect(prefill).toContain("requirió atención médica: sí");
    expect(prefill).toContain(
      "Efectos adversos de medicamentos o suplementos: sí",
    );
    expect(prefill).toContain("Antecedentes familiares: modo recorded");
    expect(prefill).toContain("diabetes: mother; hipertensión: father");
    expect(prefill).toContain("Restricciones: Mariscos, Sin lactosa añadida");
    expect(prefill).toContain("colaciones: 11:00, 17:00");
    expect(prefill).toContain("salta comidas: no");
    expect(prefill).toContain("horarios variables: no");
    expect(prefill).toContain("duración: 20To30");
    expect(prefill).toContain(
      "Patrones alimentarios: come fuera oneToTwoPerWeek",
    );
    expect(prefill).toContain("bebidas azucaradas: never");
    expect(prefill).toContain("bebidas energéticas: no");
    expect(prefill).toContain("otra bebida: infusions; alcohol: never");
    expect(prefill).toContain(
      "Digestivo: apetito normal; saciedad temprana: no",
    );
    expect(prefill).toContain("otro síntoma: no especificado");
    expect(prefill).toContain("momento: afterMeals");
    expect(prefill).toContain(
      "duración: 60 minutos; tipos: running; meta: health",
    );
    expect(prefill).toContain("detalle de limitación: Molestia de rodilla");
    expect(prefill).toContain("notas: Entrena por la mañana; TDEE: active");
    expect(prefill).toContain("Actividad diaria: tiempo sedentario sixToEight");
    expect(prefill).toContain(
      "transporte mixed; usa escaleras frecuentemente: sí",
    );

    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.intakeResponses)).toBe(true);
    expect(Object.isFrozen(context.diagnoses)).toBe(true);
    expect(Object.isFrozen(context.diagnoses[0])).toBe(true);
    expect(Object.isFrozen(context.previousSurgeries)).toBe(true);
    expect(Object.isFrozen(context.previousSurgeries[0])).toBe(true);
    expect(Object.isFrozen(context.familyHistoryDetails)).toBe(true);
    expect(Object.isFrozen(context.familyHistoryDetails?.diabetes)).toBe(true);
    expect(Object.isFrozen(context.mealRoutine)).toBe(true);
    expect(Object.isFrozen(context.mealRoutine?.snackTimes)).toBe(true);
    expect(Object.isFrozen(context.eatingPatterns)).toBe(true);
    expect(Object.isFrozen(context.digestive?.symptoms)).toBe(true);
    expect(Object.isFrozen(context.physicalActivity)).toBe(true);
    expect(Object.isFrozen(context.physicalActivity.profile)).toBe(true);
    expect(
      Object.isFrozen(context.physicalActivity.profile?.activityTypes),
    ).toBe(true);
    expect(Object.isFrozen(context.physicalActivity.dailyActivity)).toBe(true);
    expect(Object.isFrozen(context.clinicalTags)).toBe(true);
    expect(Object.isFrozen(mealPlanContext)).toBe(true);
    expect(Object.isFrozen(mealPlanContext.clinicalConsiderations)).toBe(true);
    expect(context.clinicalTags).not.toBe(patient.clinicalTags);
    expect(context.medications).not.toBe(
      patient.medicalIntake.dailyMedicationDetails,
    );
    expect(context.previousSurgeries).not.toBe(
      patient.medicalIntake.previousSurgeryDetails,
    );
    expect(context.familyHistoryDetails).not.toBe(
      patient.medicalIntake.familyHistoryDetails,
    );
    expect(context.familyHistoryDetails?.diabetes).not.toBe(
      patient.medicalIntake.familyHistoryDetails?.diabetes,
    );
    expect(context.eatingPatterns).not.toBe(
      patient.medicalIntake.nutritionIntake?.patterns,
    );
    expect(context.physicalActivity.profile).not.toBe(
      patient.medicalIntake.physicalActivityIntake?.activity,
    );
    expect(context.physicalActivity.profile?.activityTypes).not.toBe(
      patient.medicalIntake.physicalActivityIntake?.activity?.activityTypes,
    );
    expect(context.physicalActivity.dailyActivity).not.toBe(
      patient.medicalIntake.physicalActivityIntake?.dailyActivity,
    );
  });

  it("returns empty nullable sections for a null intake", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-28T12:00:00Z"));
    const patient = Patient.create({
      firstName: "Luis",
      lastName: "Reyes",
      birthDate: new Date("2000-01-01T00:00:00Z"),
      sex: "male",
      medicalIntake: null,
    });

    const context = toPatientClinicalContext(patient);

    expect(context.diagnoses).toEqual([]);
    expect(context.admissionReason).toBeNull();
    expect(context.intakeResponses).toEqual({
      diagnosedConditions: null,
      previousSurgeries: null,
      currentTreatments: null,
      intolerances: null,
      familyHistory: null,
      medications: null,
      supplements: null,
      medicationAllergies: null,
      adverseMedicationOrSupplementEffects: null,
    });
    expect(context.previousSurgeries).toEqual([]);
    expect(context.treatments).toEqual([]);
    expect(context.medications).toEqual([]);
    expect(context.supplements).toEqual([]);
    expect(context.medicationAllergies).toEqual([]);
    expect(context.intolerances).toEqual([]);
    expect(context.familyHistoryMode).toBeNull();
    expect(context.familyHistoryDetails).toBeNull();
    expect(context.adverseEffectDetails).toBeNull();
    expect(context.diet).toBeNull();
    expect(context.mealRoutine).toBeNull();
    expect(context.eatingPatterns).toBeNull();
    expect(context.mealsPerDay).toBeNull();
    expect(context.hydration).toBeNull();
    expect(context.digestive).toBeNull();
    expect(context.physicalActivity).toEqual({
      reported: null,
      level: null,
      daysPerWeek: null,
      activityLevelKey: null,
      profile: null,
      dailyActivity: null,
    });
    expect(toPatientMealPlanClinicalContext(context)).toEqual({
      diagnosisNames: [],
      restrictions: [],
      preferences: [],
      clinicalConsiderations: [],
    });
    expect(buildConsultationPrefill(context)).toBe(
      "Paciente: Luis Reyes | Edad: 26 | Sexo: male",
    );
  });

  it("preserves legacy activity without inferring level, days, or TDEE key", () => {
    const patient = Patient.create({
      firstName: "Marta",
      lastName: "Vega",
      birthDate: new Date("1985-03-10T00:00:00Z"),
      sex: "female",
      medicalIntake: { physicalActivity: true },
    });

    const context = toPatientClinicalContext(patient);

    expect(context.physicalActivity).toEqual({
      reported: true,
      level: null,
      daysPerWeek: null,
      activityLevelKey: null,
      profile: null,
      dailyActivity: null,
    });
    expect(buildConsultationPrefill(context)).toContain(
      "Actividad física reportada: sí; perfil no disponible",
    );
  });
});
