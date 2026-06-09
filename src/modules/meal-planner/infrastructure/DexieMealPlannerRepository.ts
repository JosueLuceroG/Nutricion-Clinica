import type { WeeklyPlan } from "../domain/WeeklyPlan";
import type { WeeklyPlanId } from "../domain/WeeklyPlanId";
import type { MealPlannerRepository } from "../domain/MealPlannerRepository";
import { ShoppingList } from "../domain/ShoppingList";
import { weeklyPlanToRow, rowToWeeklyPlan } from "./mealPlannerMapper";
import type { NutriClinicaDB } from "@services/db/dexieSchema";

export class DexieMealPlannerRepository implements MealPlannerRepository {
  constructor(private readonly db: NutriClinicaDB) {}

  async savePlan(plan: WeeklyPlan): Promise<void> {
    await this.db.weekly_plans.put(weeklyPlanToRow(plan));
  }

  async findPlanById(id: WeeklyPlanId): Promise<WeeklyPlan | null> {
    const row = await this.db.weekly_plans.get(id);
    return row ? rowToWeeklyPlan(row) : null;
  }

  async findPlansByPatient(patientId: string): Promise<WeeklyPlan[]> {
    const rows = await this.db.weekly_plans.where("patient_id").equals(patientId).toArray();
    return rows.map(rowToWeeklyPlan);
  }

  async findAllPlans(): Promise<WeeklyPlan[]> {
    const rows = await this.db.weekly_plans.toArray();
    return rows.map(rowToWeeklyPlan);
  }

  async deletePlan(id: WeeklyPlanId): Promise<void> {
    await this.db.weekly_plans.delete(id);
  }

  async saveShoppingList(list: ShoppingList): Promise<void> {
    const p = list.toProps();
    await this.db.shopping_lists.put({
      id: p.id,
      patient_id: p.patientId,
      weekly_plan_id: p.weeklyPlanId ?? null,
      name: p.name,
      number_of_people: p.numberOfPeople,
      currency: p.currency,
      items: p.items,
      generated_at: p.generatedAt,
      note: p.note,
    });
  }

  async findShoppingListsByPatient(patientId: string): Promise<ShoppingList[]> {
    const rows = await this.db.shopping_lists.where("patient_id").equals(patientId).toArray();
    return rows.map((row) => ShoppingList.reconstitute({
      id: row.id,
      patientId: row.patient_id,
      weeklyPlanId: row.weekly_plan_id ?? undefined,
      name: row.name,
      numberOfPeople: row.number_of_people,
      currency: row.currency,
      items: row.items,
      generatedAt: row.generated_at,
      note: row.note,
    }));
  }
}
