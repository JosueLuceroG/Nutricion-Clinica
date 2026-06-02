/**
 * Entidad de dominio: Food (alimento del catálogo SMAE).
 *
 * Hay dos fuentes:
 *  - SYSTEM: inmutables, hardcoded en `SYSTEM_FOODS.ts`. custom=false.
 *  - CUSTOM: definidos por el nutriólogo, persistidos en IndexedDB. custom=true.
 *
 * El alimento individual describe identidad, ración y gramaje. Los
 * valores nutrimentales se derivan del GRUPO al que pertenece
 * (perfil canónico SMAE 5ª edición).
 *
 * Reglas:
 *  - Inmutable: cualquier cambio produce una nueva instancia.
 *  - Sin dependencias de React, Tauri, Dexie ni de ningún framework.
 *  - `createdAt` (epoch ms) es obligatorio para alimentos custom.
 */
import { z } from "zod";
import { FoodGroupSchema, GroupNutrition, type FoodGroup, type GroupNutritionProfile } from "./FoodGroup";

export const FoodIdSchema = z
  .string()
  .min(2, "ID de alimento inválido")
  .regex(/^[a-z0-9-]+$/, "Solo minúsculas, dígitos y guiones");

export type FoodId = z.infer<typeof FoodIdSchema>;

export const FoodSchema = z.object({
  id: FoodIdSchema,
  group: FoodGroupSchema,
  name: z.string().min(1, "Nombre requerido"),
  shortName: z.string().min(1, "Nombre corto requerido"),
  serving: z.string().min(1, "Ración requerida"),
  servingGrams: z.number().positive("Gramos por ración deben ser positivos"),
  keywords: z.array(z.string().min(1)).default([]),
  custom: z.boolean().default(false),
  createdAt: z.number().int().positive().optional(),
});

export type FoodProps = z.infer<typeof FoodSchema>;

export class Food {
  private constructor(private readonly props: FoodProps) {}

  get id(): FoodId {
    return this.props.id;
  }
  get group(): FoodGroup {
    return this.props.group;
  }
  get name(): string {
    return this.props.name;
  }
  get shortName(): string {
    return this.props.shortName;
  }
  get serving(): string {
    return this.props.serving;
  }
  get servingGrams(): number {
    return this.props.servingGrams;
  }
  get keywords(): readonly string[] {
    return this.props.keywords;
  }
  get custom(): boolean {
    return this.props.custom;
  }
  get createdAt(): number | null {
    return this.props.createdAt ?? null;
  }

  get nutrition(): GroupNutritionProfile {
    return GroupNutrition[this.props.group];
  }

  toProps(): FoodProps {
    return {
      ...this.props,
      keywords: [...this.props.keywords],
    };
  }

  static create(props: FoodProps): Food {
    if (!props.name.trim()) throw new Error("Nombre de alimento requerido.");
    if (props.servingGrams <= 0) throw new Error("Gramos por ración deben ser positivos.");
    if (props.custom && !props.createdAt) {
      throw new Error("Alimentos personalizados requieren createdAt (epoch ms).");
    }
    return new Food({
      ...props,
      name: props.name.trim(),
      shortName: props.shortName.trim(),
      keywords: props.keywords.map((k) => k.toLowerCase().trim()).filter(Boolean),
    });
  }

  static reconstitute(props: FoodProps): Food {
    return new Food(props);
  }
}

export interface FoodSearchOptions {
  query?: string;
  group?: FoodGroup;
  customOnly?: boolean;
}

const normalizeText = (text: string): string =>
  text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Busca alimentos en una colección. Coincidencia case-insensitive y
 * acento-insensitive contra name + shortName + keywords.
 */
export const searchFoods = (
  foods: readonly Food[],
  opts: FoodSearchOptions = {},
): Food[] => {
  const q = opts.query?.trim() ? normalizeText(opts.query) : "";
  return foods.filter((f) => {
    if (opts.group && f.group !== opts.group) return false;
    if (opts.customOnly && !f.custom) return false;
    if (!q) return true;
    const haystack = [f.name, f.shortName, ...f.keywords].map(normalizeText);
    return haystack.some((h) => h.includes(q));
  });
};

export interface FindByEquivalenciaOptions {
  group?: FoodGroup;
  customOnly?: boolean;
}

/**
 * Equivalencia inversa a nivel de alimento: dado un kcal target,
 * devuelve los alimentos cuyo grupo cumple la tolerancia, ordenados
 * por menor delta.
 *
 * Si el nutriólogo busca "alimentos con ~70 kcal por equivalente",
 * obtendrá los cereales (s/g y c/g) y leguminosas (cercanas).
 */
export const findByEquivalencia = (
  foods: readonly Food[],
  targetKcal: number,
  toleranceKcal: number,
  opts: FindByEquivalenciaOptions = {},
): Food[] => {
  if (targetKcal <= 0) return [];
  if (toleranceKcal < 0) throw new Error("La tolerancia no puede ser negativa.");

  return foods
    .filter((f) => {
      if (opts.group && f.group !== opts.group) return false;
      if (opts.customOnly && !f.custom) return false;
      return Math.abs(f.nutrition.kcal - targetKcal) <= toleranceKcal;
    })
    .sort((a, b) => Math.abs(a.nutrition.kcal - targetKcal) - Math.abs(b.nutrition.kcal - targetKcal));
};
