import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { DexieRecipeRepository } from "./DexieRecipeRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { Recipe } from "../domain/Recipe";
import { createRecipeId } from "../domain/RecipeId";
import { RecipeNotFoundError } from "../domain/RecipeRepository";

const makeRecipe = (overrides: Partial<{ name: string; description: string; category: "entrada" | "plato_fuerte" | "postre" | "bebida" | "snack"; difficulty: "facil" | "media" | "dificil"; status: "draft" | "active" | "archived" }> = {}) => {
  return Recipe.create({
    id: createRecipeId(),
    name: overrides.name ?? "Ensalada verde",
    description: overrides.description ?? "Ensalada fresca con vegetales",
    category: overrides.category ?? "entrada",
    cuisine: "mexicana",
    difficulty: overrides.difficulty ?? "facil",
    prepTimeMin: 10,
    cookTimeMin: 0,
    servings: 2,
    servingUnit: "porción",
    ingredients: [],
    steps: [],
    notes: "",
    photoPaths: [],
    tags: [],
    allergens: [],
    currency: "MXN",
    status: overrides.status ?? "draft",
  });
};

describe("DexieRecipeRepository", () => {
  let repo: DexieRecipeRepository;
  let db: NutriClinicaDB;

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.delete();
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexieRecipeRepository(db);
  });

  it("guarda y recupera una receta por id", async () => {
    const r = makeRecipe();
    await repo.save(r);

    const found = await repo.findById(r.id);
    expect(found).not.toBeNull();
    expect(found?.name).toBe("Ensalada verde");
    expect(found?.category).toBe("entrada");
  });

  it("retorna null cuando la receta no existe", async () => {
    const found = await repo.findById(createRecipeId());
    expect(found).toBeNull();
  });

  it("findAll retorna todas las recetas ordenadas por created_at desc", async () => {
    await repo.save(makeRecipe({ name: "Receta A" }));
    await new Promise((r) => setTimeout(r, 5));
    await repo.save(makeRecipe({ name: "Receta B" }));
    await new Promise((r) => setTimeout(r, 5));
    await repo.save(makeRecipe({ name: "Receta C" }));

    const all = await repo.findAll();
    expect(all).toHaveLength(3);
    expect(all[0]?.name).toBe("Receta C");
    expect(all[1]?.name).toBe("Receta B");
    expect(all[2]?.name).toBe("Receta A");
  });

  it("delete lanza RecipeNotFoundError si no existe", async () => {
    await expect(repo.delete(createRecipeId())).rejects.toBeInstanceOf(RecipeNotFoundError);
  });

  it("delete elimina la receta", async () => {
    const r = makeRecipe();
    await repo.save(r);
    await repo.delete(r.id);

    const found = await repo.findById(r.id);
    expect(found).toBeNull();
  });

  it("search encuentra recetas por nombre", async () => {
    await repo.save(makeRecipe({ name: "Ensalada de pollo", description: "Con verduras" }));
    await repo.save(makeRecipe({ name: "Sopa de verduras", description: "Caldo de verduras" }));
    await repo.save(makeRecipe({ name: "Pollo al horno", description: "Pollo sazonado" }));

    const results = await repo.search("ensalada");
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe("Ensalada de pollo");
  });

  it("search es case-insensitive", async () => {
    await repo.save(makeRecipe({ name: "POLLO EMPANIZADO" }));

    const results = await repo.search("pollo");
    expect(results).toHaveLength(1);
  });

  it("findByStatus filtra por estado", async () => {
    const r1 = makeRecipe({ name: "Borrador", status: "draft" });
    const r2 = makeRecipe({ name: "Activa", status: "active" });
    await repo.save(r1);
    await repo.save(r2);

    const active = await repo.findByStatus("active");
    expect(active).toHaveLength(1);
    expect(active[0]?.name).toBe("Activa");
  });

  it("findByCategory filtra por categoría", async () => {
    await repo.save(makeRecipe({ name: "Ensalada", category: "entrada" }));
    await repo.save(makeRecipe({ name: "Tacos", category: "plato_fuerte" }));

    const results = await repo.findByCategory("entrada");
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe("Ensalada");
  });
});
