import { z } from "zod";

export const RecipeIdSchema = z.string().uuid();
export type RecipeId = z.infer<typeof RecipeIdSchema> & { __brand: "RecipeId" };

export function createRecipeId(): RecipeId {
  return crypto.randomUUID() as RecipeId;
}
export function recipeIdFrom(value: string): RecipeId {
  return RecipeIdSchema.parse(value) as RecipeId;
}
export function recipeIdFromUnsafe(value: string): RecipeId {
  return value as RecipeId;
}
