import { db } from "@services/db/dexieSchema";
import { DexieRecipeRepository } from "@modules/recipes/infrastructure/DexieRecipeRepository";
import { createRecipeUC, updateRecipeUC, publishRecipeUC, archiveRecipeUC, listRecipesUC, getRecipeByIdUC, deleteRecipeUC, searchRecipesUC, scaleRecipeUC } from "@modules/recipes/application/recipeUseCases";
import type { RecipeId } from "@modules/recipes/domain/RecipeId";
import type { Recipe } from "@modules/recipes/domain/Recipe";
import type { RecipeFormInput } from "@modules/recipes/application/recipeFormSchema";

const repository = new DexieRecipeRepository(db);

export const recipeService = {
  create: (input: RecipeFormInput): Promise<Recipe> => createRecipeUC(repository, input),
  update: (id: RecipeId, input: Partial<RecipeFormInput>): Promise<Recipe> => updateRecipeUC(repository, id, input),
  publish: (id: RecipeId): Promise<Recipe> => publishRecipeUC(repository, id),
  archive: (id: RecipeId): Promise<Recipe> => archiveRecipeUC(repository, id),
  list: (): Promise<Recipe[]> => listRecipesUC(repository),
  getById: (id: RecipeId): Promise<Recipe | null> => getRecipeByIdUC(repository, id),
  delete: (id: RecipeId): Promise<void> => deleteRecipeUC(repository, id),
  search: (query: string): Promise<Recipe[]> => searchRecipesUC(repository, query),
  scale: (id: RecipeId, targetServings: number): Promise<Recipe> => scaleRecipeUC(repository, id, targetServings),
};

export type RecipeService = typeof recipeService;
