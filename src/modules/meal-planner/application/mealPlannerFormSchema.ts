import { z } from "zod";
import { MealSlotSchema } from "@modules/mealplan/domain/MealSlot";
import { FoodExchangeSchema } from "@modules/mealplan/domain/MealPlan";

export const MealPlannerFormSchema = z.object({
  patientId: z.string().uuid(),
  consultationId: z.string().uuid().optional(),
  name: z.string().min(1, "Nombre requerido").max(200),
  type: z.enum(["daily", "weekly", "biweekly", "monthly"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetKcal: z.number().min(0).default(0),
  targetProteinPct: z.number().min(0).max(100).default(20),
  targetFatPct: z.number().min(0).max(100).default(25),
  targetCarbPct: z.number().min(0).max(100).default(55),
  targetFiberG: z.number().min(0).default(25),
  timesPerDay: z.number().int().min(3).max(6).default(5),
  restrictions: z.array(z.string()).default([]),
  days: z.array(z.object({
    dayNumber: z.number().int().min(1).max(31),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    meals: z.array(z.object({
      slot: MealSlotSchema,
      exchanges: z.array(FoodExchangeSchema),
      targetKcal: z.number().min(0).default(0),
    })),
    notes: z.string().max(500).default(""),
  })).default([]),
  professionalId: z.string().uuid(),
});
export type MealPlannerFormInput = z.infer<typeof MealPlannerFormSchema>;
