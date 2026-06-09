import type { RecipeRepository } from "../domain/RecipeRepository";
import { RecipeNotFoundError } from "../domain/RecipeRepository";
import type { Recipe } from "../domain/Recipe";
import type { RecipeId } from "../domain/RecipeId";
import type { RecipeStatus } from "../domain/RecipeTypes";
import { recipeDomainToRow, recipeRowToDomain } from "./recipeMapper";
import type { NutriClinicaDB } from "@services/db/dexieSchema";

export class DexieRecipeRepository implements RecipeRepository {
  constructor(private readonly db: NutriClinicaDB) {}

  async save(recipe: Recipe): Promise<void> {
    const row = recipeDomainToRow(recipe);
    await this.db.recipes.put(row);
  }

  async findById(id: RecipeId): Promise<Recipe | null> {
    const row = await this.db.recipes.get(id);
    if (!row) return null;
    return recipeRowToDomain(row);
  }

  async findAll(): Promise<Recipe[]> {
    const rows = await this.db.recipes.orderBy("created_at").reverse().toArray();
    return rows.map(recipeRowToDomain);
  }

  async findByStatus(status: RecipeStatus): Promise<Recipe[]> {
    const rows = await this.db.recipes.where("status").equals(status).toArray();
    return rows.map(recipeRowToDomain);
  }

  async findByCategory(category: string): Promise<Recipe[]> {
    const rows = await this.db.recipes.where("category").equals(category).toArray();
    return rows.map(recipeRowToDomain);
  }

  async search(query: string): Promise<Recipe[]> {
    const q = query.toLowerCase();
    const all = await this.findAll();
    return all.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)) ||
        r.description.toLowerCase().includes(q),
    );
  }

  async delete(id: RecipeId): Promise<void> {
    const existing = await this.db.recipes.get(id);
    if (!existing) throw new RecipeNotFoundError(id);
    await this.db.recipes.delete(id);
  }
}
