import { getSystemFoodById as getFood, type FoodId, GroupNutrition, type FoodGroup } from "@modules/smae/domain";
import { MEAL_SLOT_ORDER } from "../domain/MealSlot";
import type { MealPlan, PlanMeal } from "../domain/MealPlan";

export interface Macros {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface FoodExchangeWithMeta {
  foodId: FoodId;
  count: number;
  foodName: string;
  group: FoodGroup;
  serving: string;
  servingGrams: number;
  nutrition: Macros;
  totalNutrition: Macros;
}

/**
 * Calcula los macronutrientes de un solo equivalente de un alimento.
 * Si el alimento no existe en el catálogo, retorna ceros.
 */
export const foodExchangeNutrition = (foodId: FoodId, count: number): Macros => {
  const food = getFood(foodId);
  if (!food) return { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  const n = GroupNutrition[food.group];
  return {
    kcal: round(n.kcal * count),
    proteinG: round(n.proteinG * count),
    carbsG: round(n.carbsG * count),
    fatG: round(n.fatG * count),
  };
};

/**
 * Calcula los macros de un tiempo de comida (suma de todos sus equivalentes).
 */
export const mealNutrition = (meal: PlanMeal): Macros => {
  const totals: Macros = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  for (const ex of meal.exchanges) {
    const n = foodExchangeNutrition(ex.foodId, ex.count);
    totals.kcal += n.kcal;
    totals.proteinG += n.proteinG;
    totals.carbsG += n.carbsG;
    totals.fatG += n.fatG;
  }
  return roundMacros(totals);
};

/**
 * Macros diarios = suma de los 5 tiempos.
 */
export const planDailyNutrition = (plan: MealPlan): Macros => {
  const totals: Macros = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  for (const slot of MEAL_SLOT_ORDER) {
    const m = plan.getMeal(slot);
    if (!m) continue;
    const n = mealNutrition(m);
    totals.kcal += n.kcal;
    totals.proteinG += n.proteinG;
    totals.carbsG += n.carbsG;
    totals.fatG += n.fatG;
  }
  return roundMacros(totals);
};

/**
 * Diferencia entre los macros del plan y los objetivos del paciente.
 * Positivo = excedente, Negativo = déficit.
 */
export const planVsTarget = (
  plan: MealPlan,
): { kcal: number; proteinG: number; carbsG: number; fatG: number } => {
  const actual = planDailyNutrition(plan);
  return {
    kcal: round(actual.kcal - plan.kcalTarget),
    proteinG: round(actual.proteinG - plan.proteinTargetG),
    carbsG: round(actual.carbsG - plan.carbsTargetG),
    fatG: round(actual.fatG - plan.fatTargetG),
  };
};

/**
 * Convierte un PlanMeal en una lista de filas con metadatos (alimento, ración, macros).
 */
export const mealRows = (meal: PlanMeal): FoodExchangeWithMeta[] => {
  return meal.exchanges
    .map((ex) => {
      const food = getFood(ex.foodId);
      if (!food) return null;
      const n = foodExchangeNutrition(ex.foodId, ex.count);
      return {
        foodId: ex.foodId,
        count: ex.count,
        foodName: food.name,
        group: food.group,
        serving: food.serving,
        servingGrams: food.servingGrams,
        nutrition: food.nutrition,
        totalNutrition: n,
      };
    })
    .filter((x): x is FoodExchangeWithMeta => x !== null);
};

const round = (n: number): number => Math.round(n * 10) / 10;
const roundMacros = (m: Macros): Macros => ({
  kcal: Math.round(m.kcal),
  proteinG: round(m.proteinG),
  carbsG: round(m.carbsG),
  fatG: round(m.fatG),
});
