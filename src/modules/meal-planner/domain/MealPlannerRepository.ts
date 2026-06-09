import type { WeeklyPlan, WeeklyPlanProps } from "./WeeklyPlan";
import type { WeeklyPlanId } from "./WeeklyPlanId";
import type { ShoppingList, ShoppingListProps } from "./ShoppingList";

export interface MealPlannerRepository {
  savePlan(plan: WeeklyPlan): Promise<void>;
  findPlanById(id: WeeklyPlanId): Promise<WeeklyPlan | null>;
  findPlansByPatient(patientId: string): Promise<WeeklyPlan[]>;
  findAllPlans(): Promise<WeeklyPlan[]>;
  deletePlan(id: WeeklyPlanId): Promise<void>;

  saveShoppingList(list: ShoppingList): Promise<void>;
  findShoppingListsByPatient(patientId: string): Promise<ShoppingList[]>;
}

export class PlanNotFoundError extends Error {
  constructor(public readonly id: WeeklyPlanId) {
    super(`Plan semanal no encontrado: ${id}`);
    this.name = "PlanNotFoundError";
  }
}

export type { WeeklyPlan, WeeklyPlanProps, WeeklyPlanId };
export type { ShoppingList, ShoppingListProps };
