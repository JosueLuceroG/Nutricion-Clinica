import { z } from "zod";

/**
 * Estados del plan alimentario.
 *  - draft: en construcción, no se entrega al paciente
 *  - active: vigente, es el plan actual del paciente
 *  - completed: terminado (paciente egresado)
 *  - cancelled: cancelado (sustituido por otro plan)
 */
export const MealPlanStatusSchema = z.enum(["draft", "active", "completed", "cancelled"]);

export type MealPlanStatus = z.infer<typeof MealPlanStatusSchema>;

export const MealPlanStatusLabel: Record<MealPlanStatus, string> = {
  draft: "Borrador",
  active: "Activo",
  completed: "Completado",
  cancelled: "Cancelado",
};

export const MealPlanStatusColor: Record<MealPlanStatus, "info" | "warning" | "success" | "destructive" | "secondary"> = {
  draft: "secondary",
  active: "success",
  completed: "info",
  cancelled: "destructive",
};

const allowedTransitions: Record<MealPlanStatus, ReadonlyArray<MealPlanStatus>> = {
  draft: ["active", "cancelled"],
  active: ["completed", "cancelled"],
  completed: [],
  cancelled: ["draft"],
};

export const canTransitionMealPlan = (
  from: MealPlanStatus,
  to: MealPlanStatus,
): boolean => {
  if (from === to) return true;
  return allowedTransitions[from].includes(to);
};
