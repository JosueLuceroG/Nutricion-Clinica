import { MEAL_SLOT_ORDER, DEFAULT_KCAL_DISTRIBUTION, type MealSlot } from "../domain/MealSlot";
import { FOOD_GROUPS, GroupNutrition, type FoodGroup } from "@modules/smae/domain/FoodGroup";
import { getSystemFoodsByGroup } from "@modules/smae/domain/SYSTEM_FOODS";
import type { FoodId } from "@modules/smae/domain/Food";
import type { PlanMeal } from "../domain/MealPlan";

export interface SkeletonSuggestion {
  slot: MealSlot;
  targetKcal: number;
  suggestions: Array<{
    group: FoodGroup;
    exchanges: number;
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }>;
}

export interface RankedFood {
  foodId: FoodId;
  name: string;
  group: FoodGroup;
  exchanges: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  matchScore: number;
}

const DISTRIBUTION_PATTERNS: Record<string, Partial<Record<MealSlot, number>>> = {
  default: { breakfast: 0.25, "morning-snack": 0.1, lunch: 0.35, "afternoon-snack": 0.1, dinner: 0.2 },
  diabetico: { breakfast: 0.2, "morning-snack": 0.1, lunch: 0.3, "afternoon-snack": 0.15, dinner: 0.25 },
  renal: { breakfast: 0.25, "morning-snack": 0.05, lunch: 0.35, "afternoon-snack": 0.05, dinner: 0.3 },
  vegetariano: { breakfast: 0.25, "morning-snack": 0.1, lunch: 0.3, "afternoon-snack": 0.15, dinner: 0.2 },
  vegano: { breakfast: 0.25, "morning-snack": 0.1, lunch: 0.3, "afternoon-snack": 0.15, dinner: 0.2 },
};

export function generateSkeleton(
  kcalTarget: number,
  restrictions: string[],
  timesPerDay: number,
): SkeletonSuggestion[] {
  const activeSlots = MEAL_SLOT_ORDER.slice(0, timesPerDay);
  const distribution = { ...DEFAULT_KCAL_DISTRIBUTION };

  for (const r of restrictions) {
    const pattern = DISTRIBUTION_PATTERNS[r];
    if (pattern) Object.assign(distribution, pattern);
  }

  const totalPct = activeSlots.reduce((s, slot) => s + distribution[slot], 0);

  return activeSlots.map((slot) => {
    const pct = distribution[slot] / totalPct;
    const slotKcal = Math.round(kcalTarget * pct);

    const suggestions = FOOD_GROUPS
      .map((group) => {
        const n = GroupNutrition[group];
        if (n.kcal === 0) return null;
        const exchanges = Math.max(1, Math.round(slotKcal / n.kcal));
        return {
          group,
          exchanges,
          kcal: Math.round(n.kcal * exchanges),
          proteinG: Math.round(n.proteinG * exchanges),
          carbsG: Math.round(n.carbsG * exchanges),
          fatG: Math.round(n.fatG * exchanges),
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => Math.abs(a.kcal - slotKcal) - Math.abs(b.kcal - slotKcal))
      .slice(0, 5);

    return { slot, targetKcal: slotKcal, suggestions };
  });
}

export function rankFoodsByTarget(
  group: FoodGroup,
  targetKcal: number,
  targetProteinG: number,
  targetCarbsG: number,
  targetFatG: number,
  maxResults = 10,
  blacklist: string[] = [],
): RankedFood[] {
  const allByGroup = getSystemFoodsByGroup();
  const foods = (allByGroup.get(group) ?? []).filter((f: { id: string }) => !blacklist.includes(f.id));
  return foods
    .map((food: { id: string; name: string; group: FoodGroup; nutrition: { kcal: number; proteinG: number; carbsG: number; fatG: number } }) => {
      const n = food.nutrition;
      const kcalScore = targetKcal > 0 ? 1 - Math.abs(n.kcal - targetKcal) / targetKcal : 0;
      const proteinScore = targetProteinG > 0 ? 1 - Math.abs(n.proteinG - targetProteinG) / targetProteinG : 1;
      const carbsScore = targetCarbsG > 0 ? 1 - Math.abs(n.carbsG - targetCarbsG) / targetCarbsG : 1;
      const fatScore = targetFatG > 0 ? 1 - Math.abs(n.fatG - targetFatG) / targetFatG : 1;
      const matchScore = Math.round((kcalScore * 0.5 + proteinScore * 0.2 + carbsScore * 0.2 + fatScore * 0.1) * 100);

      return {
        foodId: food.id as FoodId,
        name: food.name,
        group: food.group,
        exchanges: 1,
        kcal: n.kcal,
        proteinG: n.proteinG,
        carbsG: n.carbsG,
        fatG: n.fatG,
        matchScore,
      };
    })
    .sort((a: RankedFood, b: RankedFood) => b.matchScore - a.matchScore)
    .slice(0, maxResults);
}

export function generatePlanMealsFromSkeleton(
  skeleton: SkeletonSuggestion[],
): PlanMeal[] {
  return skeleton.map((s) => ({
    slot: s.slot,
    exchanges: s.suggestions.slice(0, 3).map((sg) => ({
      foodId: "" as FoodId,
      count: sg.exchanges,
    })),
  }));
}

/**
 * Aplica sustituciones guardadas del paciente a un array de PlanMeal.
 * Recorre cada intercambio y si encuentra un original_food_id que coincida,
 * lo reemplaza por substitute_food_id.
 */
export interface SubstitutionMap {
  /** key = originalFoodId, value = substituteFoodId */
  [originalFoodId: string]: string;
}

export function applySubstitutions(
  meals: PlanMeal[],
  substitutions: SubstitutionMap,
): PlanMeal[] {
  if (Object.keys(substitutions).length === 0) return meals;
  return meals.map((meal) => ({
    ...meal,
    exchanges: meal.exchanges.map((ex) => {
      const substitute = substitutions[ex.foodId];
      if (substitute) {
        return { ...ex, foodId: substitute as FoodId };
      }
      return ex;
    }),
  }));
}
