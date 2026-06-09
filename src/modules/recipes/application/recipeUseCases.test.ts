import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { DexieRecipeRepository } from "../infrastructure/DexieRecipeRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import {
  createRecipeUC,
  updateRecipeUC,
  publishRecipeUC,
  archiveRecipeUC,
  listRecipesUC,
} from "./recipeUseCases";
import { createRecipeId } from "../domain/RecipeId";

const baseInput = {
  name: "Ensalada verde",
  description: "Ensalada fresca",
  category: "entrada" as const,
  cuisine: "mexicana",
  difficulty: "facil" as const,
  prepTimeMin: 10,
  cookTimeMin: 0,
  servings: 2,
  servingUnit: "porción",
  ingredients: [],
  steps: [],
  notes: "",
  allergens: [],
  tags: "",
  costTotal: 0,
  currency: "MXN" as const,
};

describe("recipeUseCases", () => {
  let repo: DexieRecipeRepository;
  let db: NutriClinicaDB;

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-rc-uc-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexieRecipeRepository(db);
  });

  it("createRecipeUC crea con campos correctos", async () => {
    const recipe = await createRecipeUC(repo, baseInput);

    expect(recipe.name).toBe("Ensalada verde");
    expect(recipe.category).toBe("entrada");
    expect(recipe.difficulty).toBe("facil");
    expect(recipe.status).toBe("draft");
    expect(recipe.currentVersion).toBe(1);

    const found = await repo.findById(recipe.id);
    expect(found).not.toBeNull();
  });

  it("listRecipesUC retorna todas las recetas", async () => {
    await createRecipeUC(repo, baseInput);
    await createRecipeUC(repo, { ...baseInput, name: "Sopa de verduras" });

    const all = await listRecipesUC(repo);
    expect(all).toHaveLength(2);
  });

  it("updateRecipeUC actualiza campos", async () => {
    const recipe = await createRecipeUC(repo, baseInput);

    const updated = await updateRecipeUC(repo, recipe.id, {
      name: "Ensalada verde con nueces",
      difficulty: "media",
    });

    expect(updated.name).toBe("Ensalada verde con nueces");
    expect(updated.difficulty).toBe("media");
    expect(updated.category).toBe("entrada");

    const found = await repo.findById(recipe.id);
    expect(found?.name).toBe("Ensalada verde con nueces");
  });

  it("publishRecipeUC cambia status a active", async () => {
    const recipe = await createRecipeUC(repo, baseInput);

    const published = await publishRecipeUC(repo, recipe.id);

    expect(published.status).toBe("active");
    expect(published.currentVersion).toBe(recipe.currentVersion + 1);

    const found = await repo.findById(recipe.id);
    expect(found?.status).toBe("active");
  });

  it("archiveRecipeUC cambia status a archived", async () => {
    const recipe = await createRecipeUC(repo, baseInput);

    const archived = await archiveRecipeUC(repo, recipe.id);

    expect(archived.status).toBe("archived");

    const found = await repo.findById(recipe.id);
    expect(found?.status).toBe("archived");
  });

  it("publishRecipeUC lanza si la receta no existe", async () => {
    await expect(publishRecipeUC(repo, createRecipeId())).rejects.toThrow();
  });

  it("archiveRecipeUC lanza si la receta no existe", async () => {
    await expect(archiveRecipeUC(repo, createRecipeId())).rejects.toThrow();
  });
});
