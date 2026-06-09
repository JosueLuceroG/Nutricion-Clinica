import { z } from "zod";

export const RecipeCategorySchema = z.enum([
  "entrada",
  "plato_fuerte",
  "postre",
  "bebida",
  "snack",
]);
export type RecipeCategory = z.infer<typeof RecipeCategorySchema>;
export const RecipeCategoryLabel: Record<RecipeCategory, string> = {
  entrada: "Entrada",
  plato_fuerte: "Plato fuerte",
  postre: "Postre",
  bebida: "Bebida",
  snack: "Snack",
};
export const RECIPE_CATEGORIES: readonly RecipeCategory[] = RecipeCategorySchema.options;

export const RecipeDifficultySchema = z.enum(["facil", "media", "dificil"]);
export type RecipeDifficulty = z.infer<typeof RecipeDifficultySchema>;
export const RecipeDifficultyLabel: Record<RecipeDifficulty, string> = {
  facil: "Fácil",
  media: "Media",
  dificil: "Difícil",
};

export const RecipeStatusSchema = z.enum(["draft", "active", "archived"]);
export type RecipeStatus = z.infer<typeof RecipeStatusSchema>;
export const RecipeStatusLabel: Record<RecipeStatus, string> = {
  draft: "Borrador",
  active: "Activa",
  archived: "Archivada",
};

export const AllergenSchema = z.enum([
  "leche", "huevo", "gluten", "soya", "cacahuate",
  "nueces", "pescado", "mariscos", "sesamo", "altramuz",
]);
export type Allergen = z.infer<typeof AllergenSchema>;
export const AllergenLabel: Record<Allergen, string> = {
  leche: "Leche",
  huevo: "Huevo",
  gluten: "Gluten",
  soya: "Soya",
  cacahuate: "Cacahuate",
  nueces: "Nueces",
  pescado: "Pescado",
  mariscos: "Mariscos",
  sesamo: "Sésamo",
  altramuz: "Altramuz",
};
