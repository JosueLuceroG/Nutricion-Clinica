import { describe, expect, it } from "vitest";
import { MedicalIntakeSchema } from "./pacienteRoutes.js";

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
