import { priceService } from "./priceService";

export interface ShoppingListItem {
  group: string;
  food: string;
  quantity: number;
  unit: string;
}

export interface ShoppingListCostResult {
  totalCost: number;
  currency: string;
  missingFoods: string[];
}

export async function calculateShoppingListCost(
  items: ShoppingListItem[],
  foodIdLookup: (foodName: string) => Promise<string | null>,
): Promise<ShoppingListCostResult> {
  let totalCost = 0;
  const currencies = new Set<string>();
  const missingFoods: string[] = [];

  for (const item of items) {
    const foodId = await foodIdLookup(item.food);
    if (!foodId) {
      missingFoods.push(item.food);
      continue;
    }
    const price = await priceService.getPriceForFood(foodId);
    if (!price) {
      missingFoods.push(item.food);
      continue;
    }
    currencies.add(price.currency);
    const factor = item.quantity / price.quantityBase;
    totalCost += factor * price.price;
  }

  const currency = currencies.size === 1
    ? currencies.values().next().value!
    : currencies.size > 1
      ? "MIXED"
      : priceService.getDefaultCurrency();

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    currency,
    missingFoods,
  };
}
