import { afterEach, describe, it, expect, vi } from "vitest";
import { Patient } from "./Patient";
import { Email } from "./Contact";

const baseProps = {
  firstName: "María",
  lastName: "García",
  secondLastName: "López",
  birthDate: new Date("1990-05-15"),
  sex: "female" as const,
  email: Email.from("maria.garcia@example.com"),
};

afterEach(() => {
  vi.useRealTimers();
});

describe("Patient.create", () => {
  it("crea paciente con datos válidos", () => {
    const patient = Patient.create(baseProps);
    expect(patient.firstName).toBe("María");
    expect(patient.lastName).toBe("García");
    expect(patient.secondLastName).toBe("López");
    expect(patient.fullName).toBe("María García López");
    expect(patient.email?.toString()).toBe("maria.garcia@example.com");
    expect(patient.status).toBe("active");
    expect(patient.recordStatus).toBe("active");
    expect(patient.recordOpenedAt).toBeInstanceOf(Date);
    expect(patient.clinicalTags).toEqual([]);
    expect(patient.generalNotes).toBeNull();
    expect(patient.gender).toBeNull();
    expect(patient.maritalStatus).toBeNull();
    expect(patient.occupation).toBeNull();
    expect(patient.education).toBeNull();
    expect(patient.whatsappEnabled).toBeNull();
    expect(patient.deletedAt).toBeNull();
    expect(patient.claveInterna).toBeNull();
    expect(patient.birthPlace).toBeNull();
    expect(patient.address).toBeNull();
    expect(patient.nationality).toBeNull();
    expect(patient.idType).toBeNull();
    expect(patient.idNumber).toBeNull();
    expect(patient.dischargeReason).toBeNull();
    expect(patient.responsibleProfessionalId).toBeNull();
    expect(patient.externalRecordNumber).toBeNull();
    expect(patient.admissionReason).toBeNull();
    expect(patient.photoUrl).toBeNull();
    expect(patient.medicalIntake).toEqual({
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
    });
  });

  it("crea paciente con campos opcionales completos", () => {
    const patient = Patient.create({
      ...baseProps,
      gender: "woman",
      maritalStatus: "married",
      occupation: "Ingeniera",
      education: "bachelor",
      secondaryPhone: null,
      whatsappEnabled: true,
      emergencyContactName: "Juan Pérez",
      emergencyContactRelationship: "Cónyuge",
      generalNotes: "Paciente con antecedentes",
      clinicalTags: ["diabético", "embarazo"],
      claveInterna: "CLI-001",
      birthPlace: "Ciudad de México",
      address: "Calle 123, Col. Centro",
      nationality: "Mexicana",
      idType: "INE",
      idNumber: "INE123456",
      dischargeReason: "Mejoría clínica",
      responsibleProfessionalId: "PROF-001",
      externalRecordNumber: "EXT-98765",
      admissionReason: "Primera valoración nutricional",
      photoUrl: "https://example.com/photo.jpg",
      medicalIntake: {
        diagnosedConditions: true,
        previousSurgeries: false,
        currentTreatments: true,
        intolerances: false,
        diagnosedConditionDetails: [
          {
            diagnosis: "  Diabetes mellitus tipo 2  ",
            diagnosisYear: 2020,
            status: "controlled",
            treatment: "  Metformina y plan nutricional  ",
          },
        ],
        previousSurgeryDetails: [
          {
            procedure: "  Apendicectomía  ",
            year: 2008,
            reason: "  Apendicitis aguda  ",
          },
        ],
        currentTreatmentDetails: [
          {
            name: "  Terapia física  ",
            reason: "  Dolor lumbar  ",
            frequency: "  Dos veces por semana  ",
            professional: "  Dra. Laura Martínez  ",
          },
        ],
        intoleranceDetails: [
          {
            substance: "  Lactosa  ",
            reaction: "  Distensión abdominal  ",
            severity: "moderate",
          },
        ],
        familyHistory: true,
        familyHistoryMode: "recorded",
        familyHistoryDetails: {
          diabetes: ["mother"],
          hypertension: ["father"],
          obesity: ["none"],
          cardiovascularDisease: ["maternalGrandparents"],
          dyslipidemia: ["siblings"],
          kidneyDisease: ["none"],
          thyroidDisease: ["none"],
          otherConditions: "  Cardiopatía congénita  ",
          notes: "  Diagnóstico antes de los 50 años  ",
        },
        medications: true,
        supplements: false,
        medicationAllergies: true,
        adverseMedicationOrSupplementEffects: false,
        supplementDetails: [
          {
            name: "  Omega 3  ",
            dose: "  1000 mg  ",
            frequency: "daily",
            objective: "  Salud cardiovascular  ",
          },
        ],
        medicationAllergyDetails: [
          {
            medication: "  Penicilina  ",
            reaction: "  Urticaria  ",
            severity: "moderate",
            requiredMedicalAttention: true,
          },
        ],
        dailyMedicationDetails: [
          {
            name: "  Metformina  ",
            dose: "  850 mg  ",
            frequency: "twiceDaily",
            schedule: "  08:00  ",
            reason: "  Diabetes  ",
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
            otherDietDescription: "  Flexitariana  ",
            avoidsFoods: true,
            avoidedFoods: "  Mariscos  ",
            followsFoodRestrictions: true,
            foodRestrictionDetails: "  Sin carne roja  ",
            hasFoodDiscomfort: true,
            discomfortFoods: "  Lácteos  ",
            specialPreference: "lowSodium",
            notes: "  Prefiere comida casera  ",
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
            notes: "  Agua con limón  ",
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
            otherSymptomDescription: "  Sensación de vacío  ",
            symptomTiming: "afterMeals",
            notes: "  Después de comidas abundantes  ",
          },
        },
        physicalActivity: true,
        physicalActivityIntake: {
          activity: {
            level: "moderate",
            daysPerWeek: 4,
            sessionDurationMinutes: 55,
            activityTypes: ["walking", "cycling", "walking"],
            primaryGoal: "health",
            hasPhysicalLimitation: true,
            physicalLimitationDetails: "  Molestia leve de rodilla  ",
            notes: "  Prefiere entrenar por la mañana  ",
          },
          dailyActivity: {
            sedentaryTime: "sixToEight",
            usualTransportation: "mixed",
            usesStairsFrequently: true,
            activeBreakFrequency: "sometimes",
            routineType: "moving",
            notes: "  Camina durante sus traslados  ",
          },
        },
      },
    });
    expect(patient.gender).toBe("woman");
    expect(patient.maritalStatus).toBe("married");
    expect(patient.occupation).toBe("Ingeniera");
    expect(patient.education).toBe("bachelor");
    expect(patient.whatsappEnabled).toBe(true);
    expect(patient.emergencyContactName).toBe("Juan Pérez");
    expect(patient.emergencyContactRelationship).toBe("Cónyuge");
    expect(patient.generalNotes).toBe("Paciente con antecedentes");
    expect(patient.clinicalTags).toEqual(["diabético", "embarazo"]);
    expect(patient.claveInterna).toBe("CLI-001");
    expect(patient.birthPlace).toBe("Ciudad de México");
    expect(patient.address).toBe("Calle 123, Col. Centro");
    expect(patient.nationality).toBe("Mexicana");
    expect(patient.idType).toBe("INE");
    expect(patient.idNumber).toBe("INE123456");
    expect(patient.dischargeReason).toBe("Mejoría clínica");
    expect(patient.responsibleProfessionalId).toBe("PROF-001");
    expect(patient.externalRecordNumber).toBe("EXT-98765");
    expect(patient.admissionReason).toBe("Primera valoración nutricional");
    expect(patient.photoUrl).toBe("https://example.com/photo.jpg");
    expect(patient.medicalIntake.diagnosedConditions).toBe(true);
    expect(patient.medicalIntake.previousSurgeries).toBe(false);
    expect(patient.medicalIntake.diagnosedConditionDetails).toEqual([
      {
        diagnosis: "Diabetes mellitus tipo 2",
        diagnosisYear: 2020,
        status: "controlled",
        treatment: "Metformina y plan nutricional",
      },
    ]);
    expect(patient.medicalIntake.previousSurgeryDetails).toEqual([
      {
        procedure: "Apendicectomía",
        year: 2008,
        reason: "Apendicitis aguda",
      },
    ]);
    expect(patient.medicalIntake.currentTreatmentDetails).toEqual([
      {
        name: "Terapia física",
        reason: "Dolor lumbar",
        frequency: "Dos veces por semana",
        professional: "Dra. Laura Martínez",
      },
    ]);
    expect(patient.medicalIntake.intoleranceDetails).toEqual([
      {
        substance: "Lactosa",
        reaction: "Distensión abdominal",
        severity: "moderate",
      },
    ]);
    expect(patient.medicalIntake.supplementDetails).toEqual([
      {
        name: "Omega 3",
        dose: "1000 mg",
        frequency: "daily",
        objective: "Salud cardiovascular",
      },
    ]);
    expect(patient.medicalIntake.medicationAllergyDetails).toEqual([
      {
        medication: "Penicilina",
        reaction: "Urticaria",
        severity: "moderate",
        requiredMedicalAttention: true,
      },
    ]);
    expect(patient.medicalIntake.dailyMedicationDetails).toEqual([
      {
        name: "Metformina",
        dose: "850 mg",
        frequency: "twiceDaily",
        schedule: "08:00",
        reason: "Diabetes",
        prescribedByProfessional: true,
      },
    ]);
    expect(patient.medicalIntake.physicalActivity).toBe(true);
    expect(patient.medicalIntake.physicalActivityIntake).toEqual({
      activity: {
        level: "moderate",
        daysPerWeek: 4,
        sessionDurationMinutes: 55,
        activityTypes: ["walking", "cycling"],
        primaryGoal: "health",
        hasPhysicalLimitation: true,
        physicalLimitationDetails: "Molestia leve de rodilla",
        notes: "Prefiere entrenar por la mañana",
      },
      dailyActivity: {
        sedentaryTime: "sixToEight",
        usualTransportation: "mixed",
        usesStairsFrequently: true,
        activeBreakFrequency: "sometimes",
        routineType: "moving",
        notes: "Camina durante sus traslados",
      },
    });
    expect(Object.isFrozen(patient.medicalIntake.physicalActivityIntake)).toBe(
      true,
    );
    expect(
      Object.isFrozen(patient.medicalIntake.physicalActivityIntake?.activity),
    ).toBe(true);
    expect(
      Object.isFrozen(
        patient.medicalIntake.physicalActivityIntake?.activity?.activityTypes,
      ),
    ).toBe(true);
    expect(
      Object.isFrozen(
        patient.medicalIntake.physicalActivityIntake?.dailyActivity,
      ),
    ).toBe(true);
    expect(patient.medicalIntake.familyHistoryDetails).toEqual({
      diabetes: ["mother"],
      hypertension: ["father"],
      obesity: ["none"],
      cardiovascularDisease: ["maternalGrandparents"],
      dyslipidemia: ["siblings"],
      kidneyDisease: ["none"],
      thyroidDisease: ["none"],
      otherConditions: "Cardiopatía congénita",
      notes: "Diagnóstico antes de los 50 años",
    });
    expect(patient.medicalIntake.familyHistoryMode).toBe("recorded");
    expect(patient.medicalIntake.nutritionIntake?.routine).toEqual({
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
    });
    expect(patient.medicalIntake.nutritionIntake?.patterns).toEqual({
      eatingOutFrequency: "oneToTwoPerWeek",
      snacksBetweenMeals: true,
      eatsLateAtNight: false,
      frequentCravings: true,
      cravingTime: "afternoon",
      mealPreparer: "self",
      primaryMealLocation: "home",
    });
    expect(patient.medicalIntake.nutritionIntake?.preferences).toEqual({
      usualDietType: "other",
      otherDietDescription: "Flexitariana",
      avoidsFoods: true,
      avoidedFoods: "Mariscos",
      followsFoodRestrictions: true,
      foodRestrictionDetails: "Sin carne roja",
      hasFoodDiscomfort: true,
      discomfortFoods: "Lácteos",
      specialPreference: "lowSodium",
      notes: "Prefiere comida casera",
    });
    expect(patient.medicalIntake.nutritionIntake?.hydration).toEqual({
      waterIntake: "oneAndHalfToTwoLiters",
      drinksWaterThroughoutDay: true,
      carriesWaterBottle: true,
      coffeeTeaFrequency: "oneToTwoPerDay",
      sugaryDrinkFrequency: "oneToTwoPerWeek",
      consumesEnergyDrinks: false,
      otherBeverage: "infusions",
      alcoholFrequency: "never",
      notes: "Agua con limón",
    });
    expect(patient.medicalIntake.nutritionIntake?.digestive).toEqual({
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
      notes: "Después de comidas abundantes",
    });
  });

  it("preserva el booleano heredado sin inferir un perfil", () => {
    const active = Patient.create({
      ...baseProps,
      medicalIntake: {
        physicalActivity: true,
        physicalActivityIntake: null,
      },
    });
    const inactive = Patient.create({
      ...baseProps,
      medicalIntake: { physicalActivity: false },
    });

    expect(active.medicalIntake.physicalActivity).toBe(true);
    expect(active.medicalIntake.physicalActivityIntake).toBeNull();
    expect(inactive.medicalIntake.physicalActivity).toBe(false);
    expect(inactive.medicalIntake.physicalActivityIntake).toBeNull();
  });

  it("normaliza y limpia campos condicionales de actividad física", () => {
    const patient = Patient.create({
      ...baseProps,
      medicalIntake: {
        physicalActivityIntake: {
          activity: {
            level: "light",
            daysPerWeek: 0,
            sessionDurationMinutes: 45,
            activityTypes: ["running"],
            primaryGoal: "mobility",
            hasPhysicalLimitation: false,
            physicalLimitationDetails: "  Dolor lumbar  ",
            notes: "  Desea comenzar pronto  ",
          },
          dailyActivity: {},
        },
      },
    });

    expect(patient.medicalIntake.physicalActivity).toBe(false);
    expect(patient.medicalIntake.physicalActivityIntake).toEqual({
      activity: {
        level: "light",
        daysPerWeek: 0,
        sessionDurationMinutes: null,
        activityTypes: [],
        primaryGoal: "mobility",
        hasPhysicalLimitation: false,
        physicalLimitationDetails: null,
        notes: "Desea comenzar pronto",
      },
      dailyActivity: null,
    });
  });

  it("descarta enums, rangos y núcleos de perfil inválidos", () => {
    const normalized = Patient.create({
      ...baseProps,
      medicalIntake: {
        physicalActivityIntake: {
          activity: {
            level: "intense",
            daysPerWeek: 3,
            sessionDurationMinutes: 601,
            activityTypes: ["walking", "walking", "invalid" as "walking"],
            primaryGoal: "invalid" as "health",
            hasPhysicalLimitation: true,
            physicalLimitationDetails: "   ",
            notes: null,
          },
          dailyActivity: {
            sedentaryTime: "invalid" as "sixToEight",
            usualTransportation: "car",
            usesStairsFrequently: true,
            activeBreakFrequency: "sometimes",
            routineType: "seated",
            notes: "  Trabajo de oficina  ",
          },
        },
      },
    });
    const missingCore = Patient.create({
      ...baseProps,
      medicalIntake: {
        physicalActivity: true,
        physicalActivityIntake: {
          activity: { level: "moderate", daysPerWeek: 4 },
          dailyActivity: null,
        },
      },
    });
    const invalidRange = Patient.create({
      ...baseProps,
      medicalIntake: {
        physicalActivityIntake: {
          activity: {
            level: "moderate",
            daysPerWeek: 8,
            hasPhysicalLimitation: false,
          },
          dailyActivity: [] as never,
        },
      },
    });
    const missingDailyBoolean = Patient.create({
      ...baseProps,
      medicalIntake: {
        physicalActivityIntake: {
          activity: null,
          dailyActivity: {
            sedentaryTime: "lessThan4",
            usualTransportation: "walking",
            activeBreakFrequency: "frequently",
            routineType: "moving",
            notes: null,
          },
        },
      },
    });

    expect(normalized.medicalIntake.physicalActivityIntake).toEqual({
      activity: {
        level: "intense",
        daysPerWeek: 3,
        sessionDurationMinutes: null,
        activityTypes: ["walking"],
        primaryGoal: null,
        hasPhysicalLimitation: true,
        physicalLimitationDetails: null,
        notes: null,
      },
      dailyActivity: null,
    });
    expect(missingCore.medicalIntake.physicalActivity).toBe(true);
    expect(
      missingCore.medicalIntake.physicalActivityIntake?.activity,
    ).toBeNull();
    expect(
      invalidRange.medicalIntake.physicalActivityIntake?.activity,
    ).toBeNull();
    expect(
      invalidRange.medicalIntake.physicalActivityIntake?.dailyActivity,
    ).toBeNull();
    expect(
      missingDailyBoolean.medicalIntake.physicalActivityIntake?.dailyActivity,
    ).toBeNull();
  });

  it("calcula edad correcta", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-16T12:00:00Z"));

    const patient = Patient.create({
      ...baseProps,
      birthDate: new Date("1990-06-15"),
    });
    expect(patient.age).toBe(34);
  });

  it("rechaza nombre muy corto", () => {
    expect(() => Patient.create({ ...baseProps, firstName: "A" })).toThrow(
      /al menos 2 caracteres/,
    );
  });

  it("rechaza fecha de nacimiento en el futuro", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(() => Patient.create({ ...baseProps, birthDate: future })).toThrow(
      /futuro/,
    );
  });

  it("rechaza fecha anterior a 1900", () => {
    expect(() =>
      Patient.create({ ...baseProps, birthDate: new Date("1899-01-01") }),
    ).toThrow(/1900/);
  });

  it("fullName incluye secondLastName cuando existe", () => {
    const p1 = Patient.create({ ...baseProps, secondLastName: "López" });
    expect(p1.fullName).toBe("María García López");
    const p2 = Patient.create({ ...baseProps, secondLastName: null });
    expect(p2.fullName).toBe("María García");
  });
});

describe("Patient.inmutabilidad", () => {
  it("with() retorna nueva instancia sin mutar original", () => {
    const original = Patient.create(baseProps);
    const updated = original.with({ firstName: "Ana" });

    expect(original.firstName).toBe("María");
    expect(updated.firstName).toBe("Ana");
    expect(updated.id.equals(original.id)).toBe(true);
  });

  it("with() actualiza updatedAt", () => {
    const original = Patient.create(baseProps);
    const updated = original.with({ status: "inactive" });
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      original.updatedAt.getTime(),
    );
  });

  it("with() preserva secondLastName", () => {
    const original = Patient.create(baseProps);
    const updated = original.with({ occupation: "Doctora" });
    expect(updated.secondLastName).toBe("López");
    expect(updated.occupation).toBe("Doctora");
  });

  it("with() conserva false y permite limpiar la preferencia de WhatsApp", () => {
    const original = Patient.create({ ...baseProps, whatsappEnabled: true });
    const disabled = original.with({ whatsappEnabled: false });
    const cleared = disabled.with({ whatsappEnabled: null });

    expect(disabled.whatsappEnabled).toBe(false);
    expect(cleared.whatsappEnabled).toBeNull();
    expect(original.whatsappEnabled).toBe(true);
  });

  it("softDelete() marca deletedAt y status inactive", () => {
    const patient = Patient.create({ ...baseProps, whatsappEnabled: false });
    const deleted = patient.softDelete();
    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.status).toBe("inactive");
    expect(deleted.recordStatus).toBe("inactive");
    expect(deleted.isActive).toBe(false);
    expect(deleted.whatsappEnabled).toBe(false);
  });

  it("isActive es true cuando status=active y deletedAt=null", () => {
    const patient = Patient.create(baseProps);
    expect(patient.isActive).toBe(true);
  });
});
