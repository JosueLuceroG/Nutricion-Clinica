import { describe, expect, it } from "vitest";
import { MedicalIntakeSchema } from "./pacienteRoutes.js";

const validPhysicalActivityProfile = {
  level: "moderate",
  daysPerWeek: 4,
  sessionDurationMinutes: 60,
  activityTypes: ["walking", "gym"],
  primaryGoal: "health",
  hasPhysicalLimitation: true,
  physicalLimitationDetails: "Molestia leve de rodilla",
  notes: "Entrena por la mañana",
} as const;

const validDailyActivity = {
  sedentaryTime: "sixToEight",
  usualTransportation: "publicTransport",
  usesStairsFrequently: false,
  activeBreakFrequency: "sometimes",
  routineType: "seated",
  notes: "Trabajo de oficina",
} as const;

describe("MedicalIntakeSchema", () => {
  it("accepts structured pathological history details", () => {
    const result = MedicalIntakeSchema.safeParse({
      diagnosedConditions: true,
      previousSurgeries: true,
      currentTreatments: true,
      intolerances: true,
      diagnosedConditionDetails: [
        {
          diagnosis: "Diabetes mellitus tipo 2",
          diagnosisYear: 2020,
          status: "controlled",
          treatment: null,
        },
      ],
      previousSurgeryDetails: [
        { procedure: "Apendicectomía", year: 2008, reason: null },
      ],
      currentTreatmentDetails: [
        {
          name: "Terapia física",
          reason: "Dolor lumbar",
          frequency: "Semanal",
          professional: null,
        },
      ],
      intoleranceDetails: [
        {
          substance: "Lactosa",
          reaction: "Distensión abdominal",
          severity: "moderate",
        },
      ],
      familyHistoryMode: "unknown",
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
          usualDietType: "omnivore",
          otherDietDescription: null,
          avoidsFoods: true,
          avoidedFoods: "Mariscos",
          followsFoodRestrictions: false,
          foodRestrictionDetails: null,
          hasFoodDiscomfort: true,
          discomfortFoods: "Lácteos",
          specialPreference: "lowSodium",
          notes: null,
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
          notes: null,
        },
        digestive: {
          appetiteLevel: "normal",
          earlySatiety: false,
          hasDigestiveDiscomfort: true,
          symptoms: [
            "reflux",
            "bloating",
            "gas",
            "nausea",
            "constipation",
            "diarrhea",
            "abdominalPain",
            "heartburn",
            "vomiting",
            "belching",
            "abdominalCramps",
            "other",
          ],
          otherSymptomDescription: "Sensación de vacío",
          symptomTiming: "afterMeals",
          notes: null,
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts a nested physical activity intake and legacy boolean-only data", () => {
    const result = MedicalIntakeSchema.safeParse({
      physicalActivity: true,
      physicalActivityIntake: {
        activity: validPhysicalActivityProfile,
        dailyActivity: {
          ...validDailyActivity,
          notes: "  Trabajo de oficina  ",
        },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.physicalActivityIntake?.dailyActivity?.notes).toBe(
        "Trabajo de oficina",
      );
    }
    expect(
      MedicalIntakeSchema.safeParse({
        physicalActivity: false,
        physicalActivityIntake: null,
      }).success,
    ).toBe(true);
  });

  it("rejects invalid activity ranges and conditional combinations", () => {
    const invalidProfiles = [
      { ...validPhysicalActivityProfile, level: "extreme" },
      { ...validPhysicalActivityProfile, daysPerWeek: 8 },
      { ...validPhysicalActivityProfile, sessionDurationMinutes: 0 },
      {
        ...validPhysicalActivityProfile,
        activityTypes: ["walking", "walking"],
      },
      { ...validPhysicalActivityProfile, sessionDurationMinutes: null },
      { ...validPhysicalActivityProfile, activityTypes: [] },
      {
        ...validPhysicalActivityProfile,
        daysPerWeek: 0,
        sessionDurationMinutes: 60,
        activityTypes: [],
      },
      {
        ...validPhysicalActivityProfile,
        daysPerWeek: 0,
        sessionDurationMinutes: null,
        activityTypes: ["walking"],
      },
      {
        ...validPhysicalActivityProfile,
        physicalLimitationDetails: "   ",
      },
      { ...validPhysicalActivityProfile, unexpected: true },
    ];

    for (const activity of invalidProfiles) {
      expect(
        MedicalIntakeSchema.safeParse({
          physicalActivityIntake: { activity, dailyActivity: null },
        }).success,
      ).toBe(false);
    }

    const invalidDailyActivities = [
      { ...validDailyActivity, sedentaryTime: "invalid" },
      { ...validDailyActivity, usualTransportation: "plane" },
      { ...validDailyActivity, activeBreakFrequency: "always" },
      { ...validDailyActivity, routineType: "sleeping" },
      {
        sedentaryTime: "sixToEight",
        usualTransportation: "publicTransport",
        activeBreakFrequency: "sometimes",
        routineType: "seated",
        notes: null,
      },
      { ...validDailyActivity, notes: "x".repeat(1001) },
    ];

    for (const dailyActivity of invalidDailyActivities) {
      expect(
        MedicalIntakeSchema.safeParse({
          physicalActivityIntake: {
            activity: validPhysicalActivityProfile,
            dailyActivity,
          },
        }).success,
      ).toBe(false);
    }

    expect(
      MedicalIntakeSchema.safeParse({
        physicalActivityIntake: {
          activity: validPhysicalActivityProfile,
          dailyActivity: null,
          unexpected: true,
        },
      }).success,
    ).toBe(false);
  });

  it("rejects invalid years and incomplete structured records", () => {
    expect(
      MedicalIntakeSchema.safeParse({
        diagnosedConditionDetails: [
          {
            diagnosis: "Diabetes",
            diagnosisYear: 1800,
            status: "controlled",
            treatment: null,
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      MedicalIntakeSchema.safeParse({
        intoleranceDetails: [
          { substance: "Lactosa", reaction: "", severity: "moderate" },
        ],
      }).success,
    ).toBe(false);
    expect(
      MedicalIntakeSchema.safeParse({
        nutritionIntake: {
          routine: {
            breakfastTime: "08:00",
            mainMealTime: "13:30",
            dinnerTime: "20:00",
            snackTimes: [],
            mealsPerDay: 3,
            skipsMeals: true,
            mostSkippedMeal: null,
            scheduleVaries: false,
            scheduleVariation: null,
            mealDuration: "20To30",
          },
        },
      }).success,
    ).toBe(false);
    expect(
      MedicalIntakeSchema.safeParse({
        nutritionIntake: {
          routine: null,
          patterns: {
            eatingOutFrequency: "rarely",
            snacksBetweenMeals: false,
            eatsLateAtNight: false,
            frequentCravings: true,
            cravingTime: null,
            mealPreparer: "family",
            primaryMealLocation: null,
          },
        },
      }).success,
    ).toBe(false);
    expect(
      MedicalIntakeSchema.safeParse({
        nutritionIntake: {
          routine: null,
          digestive: {
            appetiteLevel: "normal",
            earlySatiety: false,
            hasDigestiveDiscomfort: true,
            symptoms: [],
            otherSymptomDescription: null,
            symptomTiming: null,
            notes: null,
          },
        },
      }).success,
    ).toBe(false);
    expect(
      MedicalIntakeSchema.safeParse({
        nutritionIntake: {
          routine: null,
          digestive: {
            appetiteLevel: "normal",
            earlySatiety: false,
            hasDigestiveDiscomfort: true,
            symptoms: ["other"],
            otherSymptomDescription: null,
            symptomTiming: "afterMeals",
            notes: null,
          },
        },
      }).success,
    ).toBe(false);
    expect(
      MedicalIntakeSchema.safeParse({
        nutritionIntake: {
          routine: null,
          preferences: {
            usualDietType: "other",
            otherDietDescription: null,
            avoidsFoods: false,
            avoidedFoods: null,
            followsFoodRestrictions: false,
            foodRestrictionDetails: null,
            hasFoodDiscomfort: false,
            discomfortFoods: null,
            specialPreference: "none",
            notes: null,
          },
        },
      }).success,
    ).toBe(false);
    expect(
      MedicalIntakeSchema.safeParse({
        nutritionIntake: {
          routine: null,
          preferences: {
            usualDietType: "omnivore",
            otherDietDescription: null,
            avoidsFoods: false,
            avoidedFoods: null,
            followsFoodRestrictions: true,
            foodRestrictionDetails: null,
            hasFoodDiscomfort: false,
            discomfortFoods: null,
            specialPreference: "none",
            notes: null,
          },
        },
      }).success,
    ).toBe(false);
  });
});
