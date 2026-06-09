import { useState, useEffect, useCallback } from "react";
import { recipeService } from "@services/recipeService";
import type { Recipe } from "../domain/Recipe";
import type { RecipeId } from "../domain/RecipeId";
import type { RecipeFormInput } from "../application/recipeFormSchema";

export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setRecipes(await recipeService.list()); }
    catch { setRecipes([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { recipes, loading, refresh };
}

export function useRecipe(id: RecipeId | undefined) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    recipeService.getById(id).then(setRecipe).finally(() => setLoading(false));
  }, [id]);

  return { recipe, loading };
}

export function useCreateRecipe() {
  const [loading, setLoading] = useState(false);
  const create = async (input: RecipeFormInput) => {
    setLoading(true);
    try { return await recipeService.create(input); }
    finally { setLoading(false); }
  };
  return { create, loading };
}
