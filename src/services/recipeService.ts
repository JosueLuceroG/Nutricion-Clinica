import { db } from "@services/db/dexieSchema";
import { DexieRecipeRepository } from "@modules/recipes/infrastructure/DexieRecipeRepository";
import { createRecipeUC, updateRecipeUC, publishRecipeUC, archiveRecipeUC, listRecipesUC, getRecipeByIdUC, deleteRecipeUC, searchRecipesUC, scaleRecipeUC } from "@modules/recipes/application/recipeUseCases";
import type { RecipeId } from "@modules/recipes/domain/RecipeId";
import { type Recipe, type RecipeIngredient, calculateNutrition, deriveAllergensFromFoods, type FoodNutrition } from "@modules/recipes/domain/Recipe";
import type { RecipeFormInput } from "@modules/recipes/application/recipeFormSchema";
import { recordClinicalAudit } from "@services/audit/clinicalAudit";

interface FoodCacheEntry {
  nutrition: FoodNutrition;
  group: string;
  keywords: readonly string[];
}

const repository = new DexieRecipeRepository(db);

let foodCache: Map<string, FoodCacheEntry> | null = null;

async function ensureFoodCache(): Promise<Map<string, FoodCacheEntry>> {
  if (foodCache) return foodCache;
  const { smaeService } = await import("@services/smaeService");
  const all = await smaeService.search({});
  const map = new Map<string, { nutrition: FoodNutrition; group: string; keywords: readonly string[] }>();
  for (const f of all) {
    map.set(f.id, {
      nutrition: { kcal: f.nutrition.kcal, proteinG: f.nutrition.proteinG, carbsG: f.nutrition.carbsG, fatG: f.nutrition.fatG, servingGrams: f.servingGrams },
      group: f.group,
      keywords: [...f.keywords],
    });
  }
  foodCache = map;
  return map;
}

function withNutrition(recipe: Recipe, foodMap: Map<string, FoodCacheEntry>): Recipe & { kcal: number; proteinG: number; carbsG: number; fatG: number; derivedAllergens: string[] } {
  const lookup = (id: string) => foodMap.get(id)?.nutrition ?? null;
  const nutrition = calculateNutrition([...recipe.ingredients], lookup);
  const allergenLookup = (id: string) => {
    const f = foodMap.get(id);
    return f ? { group: f.group, keywords: f.keywords } : null;
  };
  const derivedAllergens = deriveAllergensFromFoods([...recipe.ingredients], allergenLookup);
  return Object.assign(recipe, { kcal: nutrition.kcal, proteinG: nutrition.proteinG, carbsG: nutrition.carbsG, fatG: nutrition.fatG, derivedAllergens });
}

export const recipeService = {
  create: async (input: RecipeFormInput): Promise<Recipe> => {
    const recipe = await createRecipeUC(repository, input);
    await recordClinicalAudit({ module: "recipes", action: "create", resourceType: "recipe", resourceId: recipe.id });
    return recipe;
  },
  update: async (id: RecipeId, input: Partial<RecipeFormInput>): Promise<Recipe> => {
    const recipe = await updateRecipeUC(repository, id, input);
    await recordClinicalAudit({ module: "recipes", action: "update", resourceType: "recipe", resourceId: recipe.id });
    return recipe;
  },
  publish: async (id: RecipeId): Promise<Recipe> => {
    const recipe = await publishRecipeUC(repository, id);
    await recordClinicalAudit({ module: "recipes", action: "update", resourceType: "recipe", resourceId: recipe.id, justification: "status:active" });
    return recipe;
  },
  archive: async (id: RecipeId): Promise<Recipe> => {
    const recipe = await archiveRecipeUC(repository, id);
    await recordClinicalAudit({ module: "recipes", action: "soft_delete", resourceType: "recipe", resourceId: recipe.id, justification: "archive" });
    return recipe;
  },
  list: (): Promise<Recipe[]> => listRecipesUC(repository),
  getById: (id: RecipeId): Promise<Recipe | null> => getRecipeByIdUC(repository, id),
  delete: async (id: RecipeId): Promise<void> => {
    await deleteRecipeUC(repository, id);
    await recordClinicalAudit({ module: "recipes", action: "remove", resourceType: "recipe", resourceId: id });
  },
  search: (query: string): Promise<Recipe[]> => searchRecipesUC(repository, query),
  scale: async (id: RecipeId, targetServings: number): Promise<Recipe> => {
    const recipe = await scaleRecipeUC(repository, id, targetServings);
    await recordClinicalAudit({ module: "recipes", action: "update", resourceType: "recipe", resourceId: recipe.id, justification: "scale" });
    return recipe;
  },

  async listWithNutrition(): Promise<Array<Recipe & { kcal: number; proteinG: number; carbsG: number; fatG: number; derivedAllergens: string[] }>> {
    const [all, foodMap] = await Promise.all([listRecipesUC(repository), ensureFoodCache()]);
    return all.map((r) => withNutrition(r, foodMap));
  },

  async getByIdWithNutrition(id: RecipeId): Promise<(Recipe & { kcal: number; proteinG: number; carbsG: number; fatG: number; derivedAllergens: string[] }) | null> {
    const [recipe, foodMap] = await Promise.all([getRecipeByIdUC(repository, id), ensureFoodCache()]);
    if (!recipe) return null;
    return withNutrition(recipe, foodMap);
  },

  async getAllergensForIngredients(ingredients: RecipeIngredient[]): Promise<string[]> {
    const foodMap = await ensureFoodCache();
    const lookup = (id: string) => {
      const f = foodMap.get(id);
      return f ? { group: f.group, keywords: f.keywords } : null;
    };
    return deriveAllergensFromFoods(ingredients, lookup);
  },
};

export type RecipeService = typeof recipeService;
