import { MEAL_SLOT_ORDER, DEFAULT_KCAL_DISTRIBUTION } from "@modules/mealplan/domain/MealSlot";
import type { MealSlot } from "@modules/mealplan/domain/MealSlot";

const restrictionAdjustments: Record<string, Partial<Record<MealSlot, number>>> = {
  diabetico: { breakfast: 0.2, "morning-snack": 0.1, lunch: 0.3, "afternoon-snack": 0.1, dinner: 0.3 },
  renal: { breakfast: 0.25, "morning-snack": 0.05, lunch: 0.35, "afternoon-snack": 0.05, dinner: 0.3 },
};

export interface MacroDistribution {
  mealDistributions: Array<{ slot: MealSlot; pct: number; kcal: number }>;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export function calculateMacroDistribution(
  targetKcal: number,
  proteinPct: number,
  fatPct: number,
  carbPct: number,
  restrictions: string[],
  timesPerDay: number,
): MacroDistribution {
  const activeSlots = MEAL_SLOT_ORDER.slice(0, timesPerDay);

  let distribution = { ...DEFAULT_KCAL_DISTRIBUTION };
  for (const r of restrictions) {
    const adj = restrictionAdjustments[r];
    if (adj) {
      distribution = { ...distribution, ...adj };
    }
  }

  const totalPct = activeSlots.reduce((s, slot) => s + distribution[slot], 0);
  const mealDistributions = activeSlots.map((slot) => {
    const pct = distribution[slot] / totalPct;
    return { slot, pct, kcal: Math.round(targetKcal * pct) };
  });

  return {
    mealDistributions,
    proteinG: Math.round((targetKcal * (proteinPct / 100)) / 4),
    fatG: Math.round((targetKcal * (fatPct / 100)) / 9),
    carbsG: Math.round((targetKcal * (carbPct / 100)) / 4),
  };
}
