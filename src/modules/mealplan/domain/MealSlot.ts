import { z } from "zod";

/**
 * Tiempo de comida del plan. 5 tiempos estándar.
 */
export const MealSlotSchema = z.enum([
  "breakfast",
  "morning-snack",
  "lunch",
  "afternoon-snack",
  "dinner",
]);

export type MealSlot = z.infer<typeof MealSlotSchema>;

export const MEAL_SLOT_ORDER: ReadonlyArray<MealSlot> = [
  "breakfast",
  "morning-snack",
  "lunch",
  "afternoon-snack",
  "dinner",
];

export const MealSlotLabel: Record<MealSlot, string> = {
  breakfast: "Desayuno",
  "morning-snack": "Colación matutina",
  lunch: "Comida",
  "afternoon-snack": "Colación vespertina",
  dinner: "Cena",
};

export const MealSlotShortLabel: Record<MealSlot, string> = {
  breakfast: "Desayuno",
  "morning-snack": "Col. AM",
  lunch: "Comida",
  "afternoon-snack": "Col. PM",
  dinner: "Cena",
};

/**
 * Distribución porcentual sugerida de kcal por tiempo de comida.
 * Útil para prescribir raciones en el formulario.
 */
export const DEFAULT_KCAL_DISTRIBUTION: Record<MealSlot, number> = {
  breakfast: 0.25,
  "morning-snack": 0.1,
  lunch: 0.35,
  "afternoon-snack": 0.1,
  dinner: 0.2,
};
