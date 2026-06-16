import type { PlanMeal, FoodExchange } from "@modules/mealplan/domain/MealPlan";
import type { FoodPrice } from "../domain/FoodPrice";
import { priceService } from "./priceService";

interface Acc {
  costTotal: number;
  currencies: Set<string>;
  missingFoodIds: string[];
  seen: Set<string>;
}

export interface MealPlanCostResult {
  costTotal: number;
  costPerDay: number;
  currency: string;
  days: number;
  missingFoodIds: string[];
}

export async function calculateMealPlanCost(
  meals: PlanMeal[],
  days: number,
  foodPriceLookup?: (foodId: string) => Promise<FoodPrice | null>,
): Promise<MealPlanCostResult> {
  const lookup = foodPriceLookup ?? ((foodId) => priceService.getPriceForFood(foodId));
  const acc: Acc = { costTotal: 0, currencies: new Set(), missingFoodIds: [], seen: new Set() };

  for (const meal of meals) {
    await processExchanges(meal.exchanges, lookup, acc);
  }

  const { currencies } = acc;
  const currency = currencies.size === 1
    ? currencies.values().next().value!
    : currencies.size > 1
      ? "MIXED"
      : priceService.getDefaultCurrency();

  return {
    costTotal: Math.round(acc.costTotal * 100) / 100,
    costPerDay: days > 0 ? Math.round((acc.costTotal / days) * 100) / 100 : 0,
    currency,
    days,
    missingFoodIds: [...new Set(acc.missingFoodIds)],
  };
}

async function processExchanges(
  exchanges: FoodExchange[],
  lookup: (foodId: string) => Promise<FoodPrice | null>,
  acc: Acc,
): Promise<void> {
  for (const ex of exchanges) {
    if (!ex.foodId || acc.seen.has(ex.foodId)) continue;
    acc.seen.add(ex.foodId);
    const price = await lookup(ex.foodId);
    if (!price) {
      acc.missingFoodIds.push(ex.foodId);
      continue;
    }
    acc.currencies.add(price.currency);
    const factor = ex.count / price.quantityBase;
    acc.costTotal += factor * price.price;
  }
}
