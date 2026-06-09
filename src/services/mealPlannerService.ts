import { db } from "@services/db/dexieSchema";
import { DexieMealPlannerRepository } from "@modules/meal-planner/infrastructure/DexieMealPlannerRepository";
import {
  createWeeklyPlanUC, listPlansByPatientUC, listAllPlansUC,
  getPlanByIdUC, deletePlanUC,
  createShoppingListFromPlanUC, listShoppingListsUC,
} from "@modules/meal-planner/application/mealPlannerUseCases";
import { calculateMacroDistribution } from "@modules/meal-planner/application/macroDistribution";
import type { WeeklyPlanId } from "@modules/meal-planner/domain/WeeklyPlanId";
import type { WeeklyPlan } from "@modules/meal-planner/domain/WeeklyPlan";
import type { MealPlannerFormInput } from "@modules/meal-planner/application/mealPlannerFormSchema";

const repository = new DexieMealPlannerRepository(db);

export const mealPlannerService = {
  createPlan: (input: MealPlannerFormInput): Promise<WeeklyPlan> =>
    createWeeklyPlanUC(repository, input),
  listByPatient: (patientId: string): Promise<WeeklyPlan[]> =>
    listPlansByPatientUC(repository, patientId),
  listAll: (): Promise<WeeklyPlan[]> => listAllPlansUC(repository),
  getById: (id: WeeklyPlanId): Promise<WeeklyPlan | null> => getPlanByIdUC(repository, id),
  deletePlan: (id: WeeklyPlanId): Promise<void> => deletePlanUC(repository, id),
  generateShoppingList: (planId: WeeklyPlanId, patientId: string) =>
    createShoppingListFromPlanUC(repository, planId, patientId),
  listShoppingLists: (patientId: string) => listShoppingListsUC(repository, patientId),
  calculateMacros: calculateMacroDistribution,
};

export type MealPlannerService = typeof mealPlannerService;
