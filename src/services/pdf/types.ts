import type { MealSlot } from "@modules/mealplan/domain/MealSlot";

export interface PdfFoodInfo {
  id: string;
  name: string;
  groupLabel: string;
  serving: string;
  kcalPerServing: number;
  proteinGPerServing: number;
  carbsGPerServing: number;
  fatGPerServing: number;
}

export interface PdfMealExchange {
  food: PdfFoodInfo;
  count: number;
}

export interface PdfMeal {
  slot: MealSlot;
  exchanges: PdfMealExchange[];
}

export interface PdfMealPlanData {
  patientName: string;
  startDate: string;
  endDate: string | null;
  name: string;
  kcalTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  meals: PdfMeal[];
  notes: string | null;
}
