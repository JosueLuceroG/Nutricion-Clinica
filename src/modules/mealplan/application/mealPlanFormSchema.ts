import { z } from "zod";
import { FoodExchangeSchema } from "../domain/MealPlan";
import { MEAL_SLOT_ORDER, MealSlotSchema, type MealSlot } from "../domain/MealSlot";

const mealSchema = z.object({
  slot: MealSlotSchema,
  exchanges: z.array(FoodExchangeSchema),
});

export const MealPlanFormSchema = z
  .object({
    name: z.string().trim().min(3, "Mínimo 3 caracteres").max(200, "Máximo 200 caracteres"),
    description: z.string().max(1000, "Máximo 1000 caracteres").optional().or(z.literal("")),
    startDate: z
      .string()
      .min(1, "Requerido")
      .refine((v) => !Number.isNaN(new Date(v).getTime()), "Fecha inválida"),
    endDate: z
      .string()
      .optional()
      .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), "Fecha inválida"),
    kcalTarget: z.coerce
      .number({ invalid_type_error: "Requerido" })
      .int("Debe ser entero")
      .min(800, "Mínimo 800 kcal")
      .max(5000, "Máximo 5000 kcal"),
    proteinTargetG: z.coerce.number().min(0).max(400),
    carbsTargetG: z.coerce.number().min(0).max(600),
    fatTargetG: z.coerce.number().min(0).max(300),
    meals: z
      .array(mealSchema)
      .refine((arr) => new Set(arr.map((m) => m.slot)).size === MEAL_SLOT_ORDER.length, {
        message: "Debe haber exactamente 5 tiempos de comida",
      }),
    notes: z.string().max(2000, "Máximo 2000 caracteres").optional().or(z.literal("")),
  })
  .strict();

export type MealPlanFormValues = z.infer<typeof MealPlanFormSchema>;

export const mealPlanFormDefaultValues: MealPlanFormValues = {
  name: "",
  description: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  kcalTarget: 1800,
  proteinTargetG: 80,
  carbsTargetG: 220,
  fatTargetG: 60,
  meals: MEAL_SLOT_ORDER.map((slot) => ({ slot, exchanges: [] })),
  notes: "",
};

export const slotOf = (values: MealPlanFormValues, slot: MealSlot) => {
  return values.meals.find((m) => m.slot === slot) ?? { slot, exchanges: [] };
};
