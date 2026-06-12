import { MealPlan, type MealPlanProps, type PlanMeal } from "../domain/MealPlan";
import { MealPlanId } from "../domain/MealPlanId";
import { PatientId } from "@modules/patient/domain/PatientId";
import { ConsultationId } from "@modules/consultation/domain/ConsultationId";
import { MEAL_SLOT_ORDER } from "../domain/MealSlot";
import type { MealPlanStatus } from "../domain/MealPlanStatus";
import type { FoodId } from "@modules/smae/domain";
import { safeDate, toIsoStringSafe, safeJsonParse } from "@services/db/safeDate";

export interface MealPlanRow {
  id: string;
  sucursal_id?: string | null;
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

const decodeMeals = (json: unknown): PlanMeal[] => {
  const raw = safeJsonParse<MealRow[]>(json, []);
  return MEAL_SLOT_ORDER.map((slot) => {
    const found = raw.find((m) => m.slot === slot);
    return {
      slot,
      exchanges: found?.exchanges ?? [],
    };
  });
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
    startDate: safeDate(row.start_date, undefined, "meal_plan.start_date")!,
    endDate: safeDate(row.end_date, null, "meal_plan.end_date"),
    kcalTarget: row.kcal_target,
    proteinTargetG: row.protein_target_g,
    carbsTargetG: row.carbs_target_g,
    fatTargetG: row.fat_target_g,
    meals: decodeMeals(row.meals_json),
    notes: row.notes,
    status: row.status,
    createdAt: safeDate(row.created_at, undefined, "meal_plan.created_at")!,
    updatedAt: safeDate(row.updated_at, undefined, "meal_plan.updated_at")!,
    deletedAt: safeDate(row.deleted_at, null, "meal_plan.deleted_at"),
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
    start_date: toIsoStringSafe(plan.startDate, new Date().toISOString(), "meal_plan.start_date")!,
    end_date: toIsoStringSafe(plan.endDate, null, "meal_plan.end_date"),
    kcal_target: plan.kcalTarget,
    protein_target_g: plan.proteinTargetG,
    carbs_target_g: plan.carbsTargetG,
    fat_target_g: plan.fatTargetG,
    meals_json: encodeMeals(plan.meals as PlanMeal[]),
    notes: plan.notes,
    status: plan.status,
    created_at: toIsoStringSafe(plan.createdAt, new Date().toISOString(), "meal_plan.created_at")!,
    updated_at: toIsoStringSafe(plan.updatedAt, new Date().toISOString(), "meal_plan.updated_at")!,
    deleted_at: toIsoStringSafe(plan.deletedAt, null, "meal_plan.deleted_at"),
  };
};
