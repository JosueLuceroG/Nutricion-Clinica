import { WeeklyPlan, type WeeklyPlanProps } from "../domain/WeeklyPlan";
import type { WeeklyPlanId } from "../domain/WeeklyPlanId";
import { ShoppingList } from "../domain/ShoppingList";

export interface WeeklyPlanRow {
  id: string;
  patient_id: string;
  consultation_id: string | null;
  name: string;
  type: string;
  start_date: string;
  end_date: string;
  target_kcal: number;
  target_protein_pct: number;
  target_fat_pct: number;
  target_carb_pct: number;
  target_fiber_g: number;
  times_per_day: number;
  restrictions: string;
  days: string;
  status: string;
  professional_id: string;
  created_at: number;
  updated_at: number;
}

export interface ShoppingListRow {
  id: string;
  patient_id: string;
  weekly_plan_id: string | null;
  name: string;
  number_of_people: number;
  currency: string;
  items: string;
  generated_at: number;
  note: string;
}

export function weeklyPlanToRow(plan: WeeklyPlan): WeeklyPlanRow {
  const p = plan.toProps();
  return {
    id: p.id,
    patient_id: p.patientId,
    consultation_id: p.consultationId ?? null,
    name: p.name,
    type: p.type,
    start_date: p.startDate,
    end_date: p.endDate,
    target_kcal: p.targetKcal,
    target_protein_pct: p.targetProteinPct,
    target_fat_pct: p.targetFatPct,
    target_carb_pct: p.targetCarbPct,
    target_fiber_g: p.targetFiberG,
    times_per_day: p.timesPerDay,
    restrictions: JSON.stringify(p.restrictions),
    days: JSON.stringify(p.days),
    status: p.status,
    professional_id: p.professionalId,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export function rowToWeeklyPlan(row: WeeklyPlanRow): WeeklyPlan {
  return WeeklyPlan.reconstitute({
    id: row.id as WeeklyPlanId,
    patientId: row.patient_id,
    consultationId: row.consultation_id ?? undefined,
    name: row.name,
    type: row.type as WeeklyPlanProps["type"],
    startDate: row.start_date,
    endDate: row.end_date,
    targetKcal: row.target_kcal,
    targetProteinPct: row.target_protein_pct,
    targetFatPct: row.target_fat_pct,
    targetCarbPct: row.target_carb_pct,
    targetFiberG: row.target_fiber_g,
    timesPerDay: row.times_per_day,
    restrictions: JSON.parse(row.restrictions) as string[],
    days: JSON.parse(row.days) as WeeklyPlanProps["days"],
    status: row.status as WeeklyPlanProps["status"],
    professionalId: row.professional_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function shoppingListToRow(list: ShoppingList): ShoppingListRow {
  const p = list.toProps();
  return {
    id: p.id,
    patient_id: p.patientId,
    weekly_plan_id: p.weeklyPlanId ?? null,
    name: p.name,
    number_of_people: p.numberOfPeople,
    currency: p.currency,
    items: p.items,
    generated_at: p.generatedAt,
    note: p.note,
  };
}

export function rowToShoppingList(row: ShoppingListRow): ShoppingList {
  return ShoppingList.reconstitute({
    id: row.id,
    patientId: row.patient_id,
    weeklyPlanId: row.weekly_plan_id ?? undefined,
    name: row.name,
    numberOfPeople: row.number_of_people,
    currency: row.currency,
    items: row.items,
    generatedAt: row.generated_at,
    note: row.note,
  });
}
