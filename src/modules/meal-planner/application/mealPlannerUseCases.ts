import { WeeklyPlan } from "../domain/WeeklyPlan";
import { createWeeklyPlanId, type WeeklyPlanId } from "../domain/WeeklyPlanId";
import { ShoppingList } from "../domain/ShoppingList";
import type { MealPlannerRepository } from "../domain/MealPlannerRepository";
import type { MealPlannerFormInput } from "./mealPlannerFormSchema";

export const createWeeklyPlanUC = async (
  repo: MealPlannerRepository,
  input: MealPlannerFormInput,
): Promise<WeeklyPlan> => {
  const plan = WeeklyPlan.create({
    id: createWeeklyPlanId(),
    patientId: input.patientId,
    consultationId: input.consultationId,
    name: input.name,
    type: input.type,
    startDate: input.startDate,
    endDate: input.endDate,
    targetKcal: input.targetKcal,
    targetProteinPct: input.targetProteinPct,
    targetFatPct: input.targetFatPct,
    targetCarbPct: input.targetCarbPct,
    targetFiberG: input.targetFiberG,
    timesPerDay: input.timesPerDay,
    restrictions: input.restrictions,
    days: input.days,
    professionalId: input.professionalId,
  });
  await repo.savePlan(plan);
  return plan;
};

export const listPlansByPatientUC = async (
  repo: MealPlannerRepository,
  patientId: string,
): Promise<WeeklyPlan[]> => {
  return repo.findPlansByPatient(patientId);
};

export const listAllPlansUC = async (repo: MealPlannerRepository): Promise<WeeklyPlan[]> => {
  return repo.findAllPlans();
};

export const getPlanByIdUC = async (
  repo: MealPlannerRepository,
  id: WeeklyPlanId,
): Promise<WeeklyPlan | null> => {
  return repo.findPlanById(id);
};

export const deletePlanUC = async (
  repo: MealPlannerRepository,
  id: WeeklyPlanId,
): Promise<void> => {
  await repo.deletePlan(id);
};

export interface GeneratedShoppingList {
  name: string;
  items: Array<{ group: string; food: string; quantity: number; unit: string }>;
}

export function generateShoppingListFromPlan(plan: WeeklyPlan): GeneratedShoppingList {
  const itemMap = new Map<string, { group: string; food: string; quantity: number; unit: string }>();

  for (const day of plan.days) {
    for (const meal of day.meals) {
      for (const exchange of meal.exchanges) {
        const key = exchange.foodId;
        const existing = itemMap.get(key);
        if (existing) {
          existing.quantity += exchange.count;
        } else {
          itemMap.set(key, { group: "general", food: key, quantity: exchange.count, unit: "ración" });
        }
      }
    }
  }

  return {
    name: `Compras: ${plan.name}`,
    items: Array.from(itemMap.values()),
  };
}

export const createShoppingListFromPlanUC = async (
  repo: MealPlannerRepository,
  planId: WeeklyPlanId,
  patientId: string,
): Promise<ShoppingList> => {
  const plan = await repo.findPlanById(planId);
  if (!plan) throw new Error(`Plan no encontrado: ${planId}`);

  const generated = generateShoppingListFromPlan(plan);
  const list = ShoppingList.create({
    patientId,
    weeklyPlanId: planId,
    name: generated.name,
    items: JSON.stringify(generated.items),
    note: "",
    currency: "MXN",
    numberOfPeople: 1,
  });
  await repo.saveShoppingList(list);
  return list;
};

export const listShoppingListsUC = async (
  repo: MealPlannerRepository,
  patientId: string,
): Promise<ShoppingList[]> => {
  return repo.findShoppingListsByPatient(patientId);
};
