import type { Recipe, RecipeProps } from "./Recipe";
import type { RecipeId } from "./RecipeId";
import type { RecipeStatus } from "./RecipeTypes";

export interface RecipeRepository {
  save(recipe: Recipe): Promise<void>;
  findById(id: RecipeId): Promise<Recipe | null>;
  findAll(): Promise<Recipe[]>;
  findByStatus(status: RecipeStatus): Promise<Recipe[]>;
  findByCategory(category: string): Promise<Recipe[]>;
  search(query: string): Promise<Recipe[]>;
  delete(id: RecipeId): Promise<void>;
}

export class RecipeNotFoundError extends Error {
  constructor(public readonly id: RecipeId) {
    super(`Receta no encontrada: ${id}`);
    this.name = "RecipeNotFoundError";
  }
}

export type { Recipe, RecipeId, RecipeProps };
