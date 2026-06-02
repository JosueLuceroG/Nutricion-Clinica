import { MealPlan, type MealPlanProps, type PlanMeal } from "../domain/MealPlan";
import { MealPlanId } from "../domain/MealPlanId";
import { PatientId } from "@modules/patient/domain/PatientId";
import { ConsultationId } from "@modules/consultation/domain/ConsultationId";
import { MEAL_SLOT_ORDER } from "../domain/MealSlot";
import type { MealPlanStatus } from "../domain/MealPlanStatus";
import type { FoodId } from "@modules/smae/domain";

export interface MealPlanRow {
  id: string;
  patient_id: string;
  consultation_id: string | null;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  kcal_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  meals_json: string;
  notes: string | null;
  status: MealPlanStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface MealExchangeRow {
  foodId: FoodId;
  count: number;
}
interface MealRow {
  slot: string;
  exchanges: MealExchangeRow[];
}

const decodeMeals = (json: string): PlanMeal[] => {
  try {
    const raw = JSON.parse(json) as MealRow[];
    return MEAL_SLOT_ORDER.map((slot) => {
      const found = raw.find((m) => m.slot === slot);
      return {
        slot,
        exchanges: found?.exchanges ?? [],
      };
    });
  } catch {
    return MEAL_SLOT_ORDER.map((slot) => ({ slot, exchanges: [] }));
  }
};

const encodeMeals = (meals: PlanMeal[]): string => {
  return JSON.stringify(
    meals.map((m) => ({
      slot: m.slot,
      exchanges: m.exchanges.map((e) => ({ foodId: e.foodId, count: e.count })),
    })),
  );
};

export const mealPlanRowToDomain = (row: MealPlanRow): MealPlan => {
  const props: MealPlanProps = {
    id: MealPlanId.fromUnsafe(row.id),
    patientId: PatientId.fromUnsafe(row.patient_id),
    consultationId: row.consultation_id ? ConsultationId.fromUnsafe(row.consultation_id) : null,
    name: row.name,
    description: row.description,
    startDate: new Date(row.start_date),
    endDate: row.end_date ? new Date(row.end_date) : null,
    kcalTarget: row.kcal_target,
    proteinTargetG: row.protein_target_g,
    carbsTargetG: row.carbs_target_g,
    fatTargetG: row.fat_target_g,
    meals: decodeMeals(row.meals_json),
    notes: row.notes,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
  };
  return MealPlan.reconstitute(props);
};

export const mealPlanDomainToRow = (plan: MealPlan): MealPlanRow => {
  return {
    id: plan.id.toString(),
    patient_id: plan.patientId.toString(),
    consultation_id: plan.consultationId?.toString() ?? null,
    name: plan.name,
    description: plan.description,
    start_date: plan.startDate.toISOString(),
    end_date: plan.endDate ? plan.endDate.toISOString() : null,
    kcal_target: plan.kcalTarget,
    protein_target_g: plan.proteinTargetG,
    carbs_target_g: plan.carbsTargetG,
    fat_target_g: plan.fatTargetG,
    meals_json: encodeMeals(plan.meals as PlanMeal[]),
    notes: plan.notes,
    status: plan.status,
    created_at: plan.createdAt.toISOString(),
    updated_at: plan.updatedAt.toISOString(),
    deleted_at: plan.deletedAt ? plan.deletedAt.toISOString() : null,
  };
};
