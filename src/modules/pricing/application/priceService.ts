import { db } from "@services/db/dexieSchema";
import type { FoodPriceRow } from "@services/db/dexieSchema";
import type { FoodPrice, FoodPriceCreate } from "../domain/FoodPrice";
import { usePreferencesStore } from "@store/preferencesStore";

function toDomain(row: FoodPriceRow): FoodPrice {
  return {
    id: row.id,
    foodId: row.food_id,
    foodName: row.food_name,
    price: row.price,
    currency: row.currency,
    quantityBase: row.quantity_base,
    unit: row.unit,
    sucursalId: row.sucursal_id,
    effectiveDate: row.effective_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const priceService = {
  async list(foodId?: string): Promise<FoodPrice[]> {
    let collection = db.food_prices.orderBy("created_at").reverse();
    if (foodId) {
      collection = db.food_prices.where("food_id").equals(foodId).reverse().sortBy("created_at") as unknown as typeof collection;
    }
    const rows = await collection.toArray();
    return rows.map(toDomain);
  },

  async getById(id: string): Promise<FoodPrice | null> {
    const row = await db.food_prices.get(id);
    return row ? toDomain(row) : null;
  },

  async create(input: FoodPriceCreate): Promise<FoodPrice> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const row: FoodPriceRow = {
      id,
      food_id: input.foodId,
      food_name: input.foodName,
      price: input.price,
      currency: input.currency,
      quantity_base: input.quantityBase,
      unit: input.unit,
      sucursal_id: input.sucursalId ?? null,
      effective_date: input.effectiveDate ?? null,
      notes: input.notes ?? "",
      created_at: now,
      updated_at: now,
    };
    await db.food_prices.add(row);
    return toDomain(row);
  },

  async update(id: string, input: Partial<FoodPriceCreate>): Promise<FoodPrice | null> {
    const existing = await db.food_prices.get(id);
    if (!existing) return null;
    const now = new Date().toISOString();
    const updates: Partial<FoodPriceRow> = { updated_at: now };
    if (input.foodId !== undefined) updates.food_id = input.foodId;
    if (input.foodName !== undefined) updates.food_name = input.foodName;
    if (input.price !== undefined) updates.price = input.price;
    if (input.currency !== undefined) updates.currency = input.currency;
    if (input.quantityBase !== undefined) updates.quantity_base = input.quantityBase;
    if (input.unit !== undefined) updates.unit = input.unit;
    if (input.sucursalId !== undefined) updates.sucursal_id = input.sucursalId ?? null;
    if (input.effectiveDate !== undefined) updates.effective_date = input.effectiveDate ?? null;
    if (input.notes !== undefined) updates.notes = input.notes ?? "";
    await db.food_prices.update(id, updates);
    return this.getById(id);
  },

  async remove(id: string): Promise<void> {
    await db.food_prices.delete(id);
  },

  async getPriceForFood(foodId: string, sucursalId?: string | null): Promise<FoodPrice | null> {
    const all = await db.food_prices.where("food_id").equals(foodId).toArray();
    if (all.length === 0) return null;
    if (sucursalId) {
      const bySucursal = all.find((p) => p.sucursal_id === sucursalId);
      if (bySucursal) return toDomain(bySucursal);
    }
    const global = all.find((p) => !p.sucursal_id);
    if (global) return toDomain(global);
    return toDomain(all[0]);
  },

  getDefaultCurrency(): string {
    return usePreferencesStore.getState().currency;
  },
};
