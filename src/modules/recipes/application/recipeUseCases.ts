import { Recipe, type RecipeProps } from "../domain/Recipe";
import { createRecipeId, type RecipeId } from "../domain/RecipeId";
import type { RecipeRepository } from "../domain/RecipeRepository";
import type { RecipeFormInput } from "./recipeFormSchema";

export const createRecipeUC = async (
  repo: RecipeRepository,
  input: RecipeFormInput,
): Promise<Recipe> => {
  const recipe = Recipe.create({
    id: createRecipeId(),
    name: input.name,
    description: input.description ?? "",
    category: input.category,
    subcategory: input.subcategory,
    cuisine: input.cuisine,
    difficulty: input.difficulty,
    prepTimeMin: input.prepTimeMin,
    cookTimeMin: input.cookTimeMin,
    servings: input.servings,
    servingUnit: input.servingUnit,
    servingWeightG: input.servingWeightG,
    ingredients: input.ingredients.map((i, idx) => ({ ...i, orderIndex: idx })),
    steps: input.steps.map((s, idx) => ({ ...s, orderIndex: idx })),
    notes: input.notes ?? "",
    photoPaths: [],
    tags: [],
    allergens: input.allergens as RecipeProps["allergens"],
    currency: input.currency as RecipeProps["currency"],
  });
  await repo.save(recipe);
  return recipe;
};

export const updateRecipeUC = async (
  repo: RecipeRepository,
  id: RecipeId,
  input: Partial<RecipeFormInput>,
): Promise<Recipe> => {
  const existing = await repo.findById(id);
  if (!existing) throw new Error(`Receta no encontrada: ${id}`);
  const updated = existing.with({
    name: input.name ?? existing.name,
    description: input.description ?? existing.description,
    category: input.category ?? existing.category,
    subcategory: input.subcategory ?? existing.subcategory,
    cuisine: input.cuisine ?? existing.cuisine,
    difficulty: input.difficulty ?? existing.difficulty,
    prepTimeMin: input.prepTimeMin ?? existing.prepTimeMin,
    cookTimeMin: input.cookTimeMin ?? existing.cookTimeMin,
    servings: input.servings ?? existing.servings,
    servingUnit: input.servingUnit ?? existing.servingUnit,
    servingWeightG: input.servingWeightG ?? existing.servingWeightG,
    ingredients: input.ingredients?.map((i, idx) => ({ ...i, orderIndex: idx })) ?? existing.toProps().ingredients,
    steps: input.steps?.map((s, idx) => ({ ...s, orderIndex: idx })) ?? existing.toProps().steps,
    notes: input.notes ?? existing.notes,
    tags: [],
    allergens: input.allergens as RecipeProps["allergens"] ?? existing.toProps().allergens,
    costTotal: input.costTotal ?? existing.costTotal,
    currency: input.currency as RecipeProps["currency"] ?? existing.currency,
  });
  await repo.save(updated);
  return updated;
};

export const publishRecipeUC = async (
  repo: RecipeRepository,
  id: RecipeId,
): Promise<Recipe> => {
  const existing = await repo.findById(id);
  if (!existing) throw new Error(`Receta no encontrada: ${id}`);
  const published = existing.publish();
  await repo.save(published);
  return published;
};

export const archiveRecipeUC = async (
  repo: RecipeRepository,
  id: RecipeId,
): Promise<Recipe> => {
  const existing = await repo.findById(id);
  if (!existing) throw new Error(`Receta no encontrada: ${id}`);
  const archived = existing.archive();
  await repo.save(archived);
  return archived;
};

export const listRecipesUC = async (repo: RecipeRepository): Promise<Recipe[]> => {
  return repo.findAll();
};

export const getRecipeByIdUC = async (
  repo: RecipeRepository,
  id: RecipeId,
): Promise<Recipe | null> => {
  return repo.findById(id);
};

export const deleteRecipeUC = async (
  repo: RecipeRepository,
  id: RecipeId,
): Promise<void> => {
  await repo.delete(id);
};

export const searchRecipesUC = async (
  repo: RecipeRepository,
  query: string,
): Promise<Recipe[]> => {
  return repo.search(query);
};

export const scaleRecipeUC = async (
  repo: RecipeRepository,
  id: RecipeId,
  targetServings: number,
): Promise<Recipe> => {
  const existing = await repo.findById(id);
  if (!existing) throw new Error(`Receta no encontrada: ${id}`);
  const scaled = existing.scale(targetServings);
  await repo.save(scaled);
  return scaled;
};
