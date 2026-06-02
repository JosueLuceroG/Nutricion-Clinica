/**
 * Composition root para el módulo SMAE. Encapsula el repositorio Dexie
 * y expone los casos de uso como funciones sincrónicas en una API estable.
 */
import { db } from "@services/db/dexieSchema";
import { DexieFoodRepository } from "@modules/smae/infrastructure/DexieFoodRepository";
import {
  searchFoodsUC,
  findByEquivalenciaUC,
  addCustomFoodUC,
  updateCustomFoodUC,
  removeCustomFoodUC,
  type SmaeCustomFoodCreateInput,
  type SmaeCustomFoodUpdateInput,
} from "@modules/smae/application/smaeUseCases";
import type {
  FoodSearchOptions,
  FindByEquivalenciaOptions,
  FoodId,
  Food,
} from "@modules/smae/domain/Food";
import type { FoodRepository } from "@modules/smae/domain/FoodRepository";

const repository: FoodRepository = new DexieFoodRepository(db);

export const smaeService = {
  search: (opts: FoodSearchOptions): Promise<Food[]> => searchFoodsUC(repository, opts),
  findByEquivalencia: (
    targetKcal: number,
    toleranceKcal: number,
    opts?: FindByEquivalenciaOptions,
  ): Promise<Food[]> => findByEquivalenciaUC(repository, targetKcal, toleranceKcal, opts),
  addCustom: (input: SmaeCustomFoodCreateInput, now?: number): Promise<Food> =>
    addCustomFoodUC(repository, input, now),
  updateCustom: (id: FoodId, input: SmaeCustomFoodUpdateInput): Promise<Food> =>
    updateCustomFoodUC(repository, id, input),
  removeCustom: (id: FoodId): Promise<void> => removeCustomFoodUC(repository, id),
};

export type SmaeService = typeof smaeService;
