import { z } from "zod";
import i18n from "../../../i18n/config";
import { FoodExchangeSchema } from "../domain/MealPlan";
import { MEAL_SLOT_ORDER, MealSlotSchema, type MealSlot } from "../domain/MealSlot";

const mealSchema = z.object({
  slot: MealSlotSchema,
  exchanges: z.array(FoodExchangeSchema),
});

export const MealPlanFormSchema = z
  .object({
    name: z.string().trim().min(3, i18n.t("errors.min_chars", { n: 3 })).max(200, i18n.t("errors.max_chars", { n: 200 })),
    description: z.string().max(1000, i18n.t("errors.max_chars", { n: 1000 })).optional().or(z.literal("")),
    startDate: z
      .string()
      .min(1, i18n.t("errors.required"))
      .refine((v) => !Number.isNaN(new Date(v).getTime()), i18n.t("errors.invalid_date")),
    endDate: z
      .string()
      .optional()
      .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), i18n.t("errors.invalid_date")),
    kcalTarget: z.coerce
      .number({ invalid_type_error: i18n.t("errors.required") })
      .int(i18n.t("errors.must_be_integer"))
      .min(800, i18n.t("errors.min_kcal"))
      .max(5000, i18n.t("errors.max_kcal")),
    proteinTargetG: z.coerce.number().min(0).max(400),
    carbsTargetG: z.coerce.number().min(0).max(600),
    fatTargetG: z.coerce.number().min(0).max(300),
    meals: z
      .array(mealSchema)
      .refine((arr) => new Set(arr.map((m) => m.slot)).size === MEAL_SLOT_ORDER.length, {
        message: i18n.t("errors.exactly_5_meals"),
      }),
    notes: z.string().max(2000, i18n.t("errors.max_chars", { n: 2000 })).optional().or(z.literal("")),
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
