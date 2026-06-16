export interface FoodPrice {
  id: string;
  foodId: string;
  foodName: string;
  price: number;
  currency: string;
  quantityBase: number;
  unit: string;
  sucursalId: string | null;
  effectiveDate: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface FoodPriceCreate {
  foodId: string;
  foodName: string;
  price: number;
  currency: string;
  quantityBase: number;
  unit: string;
  sucursalId?: string | null;
  effectiveDate?: string | null;
  notes?: string;
}
