import { z } from "zod";

export const MealPlanTypeSchema = z.enum(["daily", "weekly", "biweekly", "monthly"]);
export type MealPlanType = z.infer<typeof MealPlanTypeSchema>;

export const WeeklyPlanStatusSchema = z.enum(["draft", "active", "completed", "cancelled"]);
export type WeeklyPlanStatus = z.infer<typeof WeeklyPlanStatusSchema>;
export const WeeklyPlanStatusLabel: Record<WeeklyPlanStatus, string> = {
  draft: "Borrador",
  active: "Activo",
  completed: "Completado",
  cancelled: "Cancelado",
};

export const RestrictionSchema = z.enum([
  "vegetariano", "vegano", "renal", "diabetico", "hiposodico",
  "sin_gluten", "sin_lactosa", "bajo_fodmap", "ninguna",
]);
export type Restriction = z.infer<typeof RestrictionSchema>;
