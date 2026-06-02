/**
 * Casos de uso del módulo SMAE: composición de dominio + repositorio.
 *
 * Convenciones:
 *  - Todos retornan el dominio o void; no retornan DTOs de UI.
 *  - Validación de input (Zod) ocurre en el boundary de UI, no aquí.
 *  - `now` se inyecta en `addCustomFood` para tests deterministas.
 */
import {
  Food,
  SYSTEM_FOODS,
  searchFoods,
  findByEquivalencia,
  type FoodId,
  type FoodProps,
  type FoodSearchOptions,
  type FindByEquivalenciaOptions,
  type FoodRepository,
  FoodNotFoundError,
} from "../domain";
import { parseKeywordsInput } from "./smaeFormSchema";

export type SmaeCustomFoodCreateInput = Omit<FoodProps, "custom" | "createdAt">;

export type SmaeCustomFoodUpdateInput = Partial<
  Omit<FoodProps, "custom" | "createdAt" | "id" | "keywords">
> & {
  keywords?: string[];
};

const collectAllFoods = async (repo: FoodRepository): Promise<Food[]> => {
  const custom = await repo.findAllCustom();
  return [...SYSTEM_FOODS, ...custom];
};

export const searchFoodsUC = async (
  repo: FoodRepository,
  opts: FoodSearchOptions,
): Promise<Food[]> => {
  return searchFoods(await collectAllFoods(repo), opts);
};

export const findByEquivalenciaUC = async (
  repo: FoodRepository,
  targetKcal: number,
  toleranceKcal: number,
  opts: FindByEquivalenciaOptions = {},
): Promise<Food[]> => {
  return findByEquivalencia(await collectAllFoods(repo), targetKcal, toleranceKcal, opts);
};

export const addCustomFoodUC = async (
  repo: FoodRepository,
  input: SmaeCustomFoodCreateInput,
  now: number = Date.now(),
): Promise<Food> => {
  const food = Food.create({
    id: input.id,
    group: input.group,
    name: input.name,
    shortName: input.shortName,
    serving: input.serving,
    servingGrams: input.servingGrams,
    keywords: input.keywords,
    custom: true,
    createdAt: now,
  });
  await repo.save(food);
  return food;
};

export const updateCustomFoodUC = async (
  repo: FoodRepository,
  id: FoodId,
  input: SmaeCustomFoodUpdateInput,
): Promise<Food> => {
  const existing = await repo.findById(id);
  if (!existing) throw new FoodNotFoundError(id);
  const next = Food.create({
    id: existing.id,
    group: input.group ?? existing.group,
    name: input.name ?? existing.name,
    shortName: input.shortName ?? existing.shortName,
    serving: input.serving ?? existing.serving,
    servingGrams: input.servingGrams ?? existing.servingGrams,
    keywords: input.keywords ?? [...existing.keywords],
    custom: true,
    createdAt: existing.createdAt ?? Date.now(),
  });
  await repo.save(next);
  return next;
};

export const removeCustomFoodUC = async (
  repo: FoodRepository,
  id: FoodId,
): Promise<void> => {
  await repo.delete(id);
};

export { parseKeywordsInput };
