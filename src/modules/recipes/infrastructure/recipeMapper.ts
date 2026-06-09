import { Recipe, type RecipeProps } from "../domain/Recipe";
import type { RecipeId } from "../domain/RecipeId";

export interface RecipeRow {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory: string | null;
  cuisine: string;
  difficulty: string;
  prep_time_min: number;
  cook_time_min: number;
  servings: number;
  serving_unit: string;
  serving_weight_g: number | null;
  ingredients_json: string;
  steps_json: string;
  notes: string;
  photo_paths_json: string;
  tags_json: string;
  allergens_json: string;
  cost_total: number;
  cost_per_serving: number;
  currency: string;
  status: string;
  current_version: number;
  created_at: number;
  updated_at: number;
}

export function recipeRowToDomain(row: RecipeRow): Recipe {
  const ingredients = JSON.parse(row.ingredients_json);
  const steps = JSON.parse(row.steps_json);
  return Recipe.reconstitute({
    id: row.id as RecipeId,
    name: row.name,
    description: row.description,
    category: row.category as RecipeProps["category"],
    subcategory: row.subcategory ?? undefined,
    cuisine: row.cuisine,
    difficulty: row.difficulty as RecipeProps["difficulty"],
    prepTimeMin: row.prep_time_min,
    cookTimeMin: row.cook_time_min,
    servings: row.servings,
    servingUnit: row.serving_unit,
    servingWeightG: row.serving_weight_g ?? undefined,
    ingredients,
    steps,
    notes: row.notes,
    photoPaths: JSON.parse(row.photo_paths_json),
    tags: JSON.parse(row.tags_json),
    allergens: JSON.parse(row.allergens_json),
    costTotal: row.cost_total,
    costPerServing: row.cost_per_serving,
    currency: row.currency,
    status: row.status as RecipeProps["status"],
    currentVersion: row.current_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function recipeDomainToRow(recipe: Recipe): RecipeRow {
  const p = recipe.toProps();
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    subcategory: p.subcategory ?? null,
    cuisine: p.cuisine,
    difficulty: p.difficulty,
    prep_time_min: p.prepTimeMin,
    cook_time_min: p.cookTimeMin,
    servings: p.servings,
    serving_unit: p.servingUnit,
    serving_weight_g: p.servingWeightG ?? null,
    ingredients_json: JSON.stringify(p.ingredients),
    steps_json: JSON.stringify(p.steps),
    notes: p.notes,
    photo_paths_json: JSON.stringify(p.photoPaths),
    tags_json: JSON.stringify(p.tags),
    allergens_json: JSON.stringify(p.allergens),
    cost_total: p.costTotal,
    cost_per_serving: p.costPerServing,
    currency: p.currency,
    status: p.status,
    current_version: p.currentVersion,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}
