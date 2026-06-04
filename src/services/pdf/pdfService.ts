import type { MealPlan } from "@modules/mealplan/domain/MealPlan";
import { GroupNutrition, FoodGroupLabel, type FoodGroup } from "@modules/smae/domain/FoodGroup";
import { Food, type FoodId } from "@modules/smae/domain/Food";
import type { Patient } from "@modules/patient/domain/Patient";
import { generateMealPlanPdf, downloadPdf } from "./generators/mealPlanPdf";
import type { PdfMealPlanData, PdfMeal, PdfMealExchange, PdfFoodInfo } from "./types";

type FoodLookupFn = (foodId: FoodId) => Food;

function defaultLookup(foodId: FoodId): Food {
  return Food.reconstitute({ id: foodId, group: "verduras" as FoodGroup, name: foodId, shortName: foodId, serving: "1 raci\u00f3n", servingGrams: 100, keywords: [], custom: false });
}

function toPdfFoodInfo(food: Food): PdfFoodInfo {
  const profile = GroupNutrition[food.group];
  return {
    id: food.id,
    name: food.name,
    groupLabel: FoodGroupLabel[food.group],
    serving: food.serving,
    kcalPerServing: profile.kcal,
    proteinGPerServing: profile.proteinG,
    carbsGPerServing: profile.carbsG,
    fatGPerServing: profile.fatG,
  };
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
}

export const pdfService = {
  generateMealPlanPdf(
    mealPlan: MealPlan,
    patient: Patient,
    lookupFood: FoodLookupFn = defaultLookup,
  ): PdfMealPlanData {
    const meals: PdfMeal[] = mealPlan.meals.map((pm) => {
      const exchanges: PdfMealExchange[] = pm.exchanges.map((ex) => {
        const food = lookupFood(ex.foodId);
        return { food: toPdfFoodInfo(food), count: ex.count };
      });
      return { slot: pm.slot, exchanges };
    });

    return {
      patientName: patient.fullName,
      startDate: formatDate(mealPlan.startDate),
      endDate: mealPlan.endDate ? formatDate(mealPlan.endDate) : null,
      name: mealPlan.name,
      kcalTarget: mealPlan.kcalTarget,
      proteinTargetG: mealPlan.proteinTargetG,
      carbsTargetG: mealPlan.carbsTargetG,
      fatTargetG: mealPlan.fatTargetG,
      meals,
      notes: mealPlan.notes,
    };
  },

  createPdfDocument(data: PdfMealPlanData) {
    return generateMealPlanPdf(data);
  },

  download(data: PdfMealPlanData, fileName?: string) {
    const doc = generateMealPlanPdf(data);
    downloadPdf(doc, fileName ?? `plan-alimentacion-${data.patientName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
  },
};

export type PdfService = typeof pdfService;
