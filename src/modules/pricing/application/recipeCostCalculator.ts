import type { RecipeIngredient } from "@modules/recipes/domain/Recipe";
import type { FoodPrice } from "../domain/FoodPrice";
import { priceService } from "./priceService";

export interface CostResult {
  costTotal: number;
  costPerServing: number;
  currency: string;
  missingFoodIds: string[];
  mixedCurrency: boolean;
}

export async function calculateRecipeCost(
  ingredients: readonly RecipeIngredient[],
  servings: number,
  priceLookup?: (foodId: string) => Promise<FoodPrice | null>,
): Promise<CostResult> {
  const lookup = priceLookup ?? ((foodId) => priceService.getPriceForFood(foodId));
  let costTotal = 0;
  const currencies = new Set<string>();
  const missingFoodIds: string[] = [];

  for (const ing of ingredients) {
    if (!ing.equivalentId) continue;
    const price = await lookup(ing.equivalentId);
    if (!price) {
      missingFoodIds.push(ing.equivalentId);
      continue;
    }
    currencies.add(price.currency);
    const factor = (ing.weightG ?? ing.quantity) / price.quantityBase;
    costTotal += factor * price.price;
  }

  const currency = currencies.size === 1
    ? currencies.values().next().value!
    : currencies.size > 1
      ? "MIXED"
      : priceService.getDefaultCurrency();

  return {
    costTotal: Math.round(costTotal * 100) / 100,
    costPerServing: servings > 0 ? Math.round((costTotal / servings) * 100) / 100 : 0,
    currency,
    missingFoodIds,
    mixedCurrency: currencies.size > 1,
  };
}
