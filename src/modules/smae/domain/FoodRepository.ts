/**
 * Puerto (interfaz) del repositorio de alimentos personalizados.
 *
 * Solo persiste alimentos custom (los del sistema viven en SYSTEM_FOODS
 * y son inmutables). Las implementaciones viven en la capa de
 * infraestructura (Dexie/IndexedDB, futuro SQLite/Tauri).
 */
import type { Food, FoodId } from "./Food";

export interface FoodRepository {
  save(food: Food): Promise<void>;
  findById(id: FoodId): Promise<Food | null>;
  findAllCustom(): Promise<Food[]>;
  delete(id: FoodId): Promise<void>;
}

export class FoodNotFoundError extends Error {
  constructor(public readonly id: FoodId) {
    super(`Alimento no encontrado: ${id}`);
    this.name = "FoodNotFoundError";
  }
}

export class DuplicateFoodError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateFoodError";
  }
}

export { Food, type FoodId, type FoodProps } from "./Food";
