import { z } from "zod";
import { RecipeCategorySchema } from "../domain/RecipeTypes";
import { RecipeIngredientSchema, RecipeStepSchema } from "../domain/Recipe";

export const RecipeFormSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(200),
  description: z.string().max(1000).default(""),
  category: RecipeCategorySchema,
  subcategory: z.string().max(100).optional(),
  cuisine: z.string().max(100).default("mexicana"),
  difficulty: z.enum(["facil", "media", "dificil"]),
  prepTimeMin: z.coerce.number().int().min(0).default(0),
  cookTimeMin: z.coerce.number().int().min(0).default(0),
  servings: z.coerce.number().int().positive().default(4),
  servingUnit: z.string().default("porción"),
  servingWeightG: z.coerce.number().positive().optional(),
  ingredients: z.array(RecipeIngredientSchema).default([]),
  steps: z.array(RecipeStepSchema).default([]),
  notes: z.string().max(2000).default(""),
  tags: z.string().default(""),
  allergens: z.array(z.string()).default([]),
  costTotal: z.coerce.number().min(0).default(0),
  currency: z.string().default("MXN"),
});
export type RecipeFormInput = z.infer<typeof RecipeFormSchema>;

export const IngredientFormSchema = z.object({
  equivalentId: z.string().min(1, "Selecciona un alimento"),
  name: z.string().min(1),
  quantity: z.coerce.number().positive("Cantidad debe ser positiva"),
  unit: z.string().default("pieza"),
  weightG: z.coerce.number().positive().optional(),
  isOptional: z.boolean().default(false),
});
export type IngredientFormInput = z.infer<typeof IngredientFormSchema>;

export const StepFormSchema = z.object({
  description: z.string().min(1, "Descripción requerida"),
  durationMin: z.coerce.number().int().positive().optional(),
  temperature: z.string().optional(),
});
export type StepFormInput = z.infer<typeof StepFormSchema>;

export function parseTags(input: string): string[] {
  return input.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}
