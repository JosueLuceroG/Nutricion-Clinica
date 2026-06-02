/**
 * Zod schemas para el formulario de alimentos personalizados (UI boundary).
 * Los keywords se capturan como string separado por comas (UX friendly) y
 * se transforman a `string[]` en el momento de aplicar el use case.
 */
import { z } from "zod";
import { FoodGroupSchema } from "../domain/FoodGroup";

export const SmaeCustomFoodFormSchema = z.object({
  id: z
    .string()
    .min(2, "ID requerido")
    .regex(/^[a-z0-9-]+$/, "Solo minúsculas, dígitos y guiones"),
  group: FoodGroupSchema,
  name: z
    .string()
    .min(1, "Nombre requerido")
    .max(80, "Máximo 80 caracteres"),
  shortName: z
    .string()
    .min(1, "Nombre corto requerido")
    .max(40, "Máximo 40 caracteres"),
  serving: z
    .string()
    .min(1, "Ración requerida")
    .max(120, "Máximo 120 caracteres"),
  servingGrams: z
    .number({ invalid_type_error: "Gramos por ración requeridos" })
    .positive("Gramos deben ser positivos")
    .max(2000, "Máximo 2000 g"),
  keywordsInput: z.string().optional().default(""),
});

export type SmaeCustomFoodFormInput = z.infer<typeof SmaeCustomFoodFormSchema>;

export const SmaeCustomFoodUpdateSchema = SmaeCustomFoodFormSchema.partial().omit({ id: true });

export type SmaeCustomFoodUpdateFormInput = z.infer<typeof SmaeCustomFoodUpdateSchema>;

/**
 * Convierte el string separado por comas del form a un array de keywords
 * normalizado (lowercase, trimmed, sin vacíos).
 */
export const parseKeywordsInput = (input: string | undefined): string[] => {
  if (!input) return [];
  return input
    .split(",")
    .map((s) => s.toLowerCase().trim())
    .filter(Boolean);
};
