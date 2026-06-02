/**
 * Implementación Dexie/IndexedDB del repositorio de alimentos personalizados.
 * Solo persiste `custom: true`; los del sistema viven hardcoded.
 */
import type { FoodRepository } from "../domain/FoodRepository";
import { FoodNotFoundError } from "../domain/FoodRepository";
import type { Food, FoodId } from "../domain/Food";
import { smaeFoodDomainToRow, smaeFoodRowToDomain } from "./smaeMapper";
import { NutriClinicaDB } from "@services/db/dexieSchema";

export class DexieFoodRepository implements FoodRepository {
  constructor(private readonly dbInstance: NutriClinicaDB = new NutriClinicaDB()) {}

  async save(food: Food): Promise<void> {
    if (!food.custom) {
      throw new Error("Solo se persisten alimentos personalizados (custom=true).");
    }
    const row = smaeFoodDomainToRow(food);
    await this.dbInstance.smae_custom_foods.put(row);
  }

  async findById(id: FoodId): Promise<Food | null> {
    const row = await this.dbInstance.smae_custom_foods.get(id);
    if (!row) return null;
    return smaeFoodRowToDomain(row);
  }

  async findAllCustom(): Promise<Food[]> {
    const rows = await this.dbInstance.smae_custom_foods.orderBy("created_at").reverse().toArray();
    return rows.map(smaeFoodRowToDomain);
  }

  async delete(id: FoodId): Promise<void> {
    const existing = await this.dbInstance.smae_custom_foods.get(id);
    if (!existing) throw new FoodNotFoundError(id);
    await this.dbInstance.smae_custom_foods.delete(id);
  }
}
