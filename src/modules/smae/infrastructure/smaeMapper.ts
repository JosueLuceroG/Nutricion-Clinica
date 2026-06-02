/**
 * Mappers entre el dominio `Food` y la fila `SmaeCustomFoodRow` de Dexie.
 *
 * Solo los alimentos CUSTOM (custom=true) se persisten; los del sistema
 * viven hardcoded en `domain/SYSTEM_FOODS.ts`.
 */
import { Food, type FoodId, type FoodProps } from "../domain/Food";
import type { FoodGroup } from "../domain/FoodGroup";

export interface SmaeCustomFoodRow {
  id: string;
  group: string;
  name: string;
  short_name: string;
  serving: string;
  serving_grams: number;
  keywords_json: string;
  custom: 1;
  created_at: number;
}

export const smaeFoodRowToDomain = (row: SmaeCustomFoodRow): Food => {
  let keywords: string[] = [];
  try {
    const parsed = JSON.parse(row.keywords_json);
    if (Array.isArray(parsed) && parsed.every((k) => typeof k === "string")) {
      keywords = parsed;
    }
  } catch {
    keywords = [];
  }
  return Food.reconstitute({
    id: row.id as FoodId,
    group: row.group as FoodGroup,
    name: row.name,
    shortName: row.short_name,
    serving: row.serving,
    servingGrams: row.serving_grams,
    keywords,
    custom: true,
    createdAt: row.created_at,
  } satisfies FoodProps);
};

export const smaeFoodDomainToRow = (food: Food): SmaeCustomFoodRow => {
  if (!food.custom || !food.createdAt) {
    throw new Error("Solo alimentos personalizados (custom=true con createdAt) se persisten.");
  }
  return {
    id: food.id,
    group: food.group,
    name: food.name,
    short_name: food.shortName,
    serving: food.serving,
    serving_grams: food.servingGrams,
    keywords_json: JSON.stringify(food.keywords),
    custom: 1,
    created_at: food.createdAt,
  };
};
