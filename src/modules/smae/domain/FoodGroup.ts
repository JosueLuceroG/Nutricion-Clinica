/**
 * Grupos de alimentos del SMAE 5ª edición.
 * Cada grupo tiene un valor nutrimental fijo por equivalente (ración).
 *
 * Esta es la fuente canónica del SMAE 5ª edición. Cualquier cálculo
 * nutricional en la app se deriva de estos valores.
 *
 * Nota: existe una copia transitoria en `mealplan/domain/FoodGroup.ts`
 * que se eliminará en el commit 6 (refactor de imports).
 */
import { z } from "zod";

export const FoodGroupSchema = z.enum([
  "verduras",
  "frutas",
  "cereales-sin-grasa",
  "cereales-con-grasa",
  "leguminosas",
  "aoa-muy-bajo",
  "aoa-bajo",
  "aoa-moderado",
  "aoa-alto",
  "leche-entera",
  "leche-semidescremada",
  "leche-descremada",
  "aceites-sin-proteina",
  "aceites-con-proteina",
  "azucares-sin-grasa",
  "azucares-con-grasa",
]);

export type FoodGroup = z.infer<typeof FoodGroupSchema>;

export const FOOD_GROUPS: readonly FoodGroup[] = FoodGroupSchema.options;

export const FoodGroupLabel: Record<FoodGroup, string> = {
  verduras: "Verduras",
  frutas: "Frutas",
  "cereales-sin-grasa": "Cereales sin grasa",
  "cereales-con-grasa": "Cereales con grasa",
  leguminosas: "Leguminosas",
  "aoa-muy-bajo": "AOA · Muy bajo aporte de grasa",
  "aoa-bajo": "AOA · Bajo aporte de grasa",
  "aoa-moderado": "AOA · Moderado aporte de grasa",
  "aoa-alto": "AOA · Alto aporte de grasa",
  "leche-entera": "Leche entera",
  "leche-semidescremada": "Leche semidescremada",
  "leche-descremada": "Leche descremada",
  "aceites-sin-proteina": "Aceites sin proteína",
  "aceites-con-proteina": "Aceites con proteína",
  "azucares-sin-grasa": "Azúcares sin grasa",
  "azucares-con-grasa": "Azúcares con grasa",
};

export const FoodGroupShortLabel: Record<FoodGroup, string> = {
  verduras: "Verduras",
  frutas: "Frutas",
  "cereales-sin-grasa": "Cereales s/g",
  "cereales-con-grasa": "Cereales c/g",
  leguminosas: "Leguminosas",
  "aoa-muy-bajo": "AOA muy bajo",
  "aoa-bajo": "AOA bajo",
  "aoa-moderado": "AOA moderado",
  "aoa-alto": "AOA alto",
  "leche-entera": "Leche entera",
  "leche-semidescremada": "Leche semi.",
  "leche-descremada": "Leche desc.",
  "aceites-sin-proteina": "Aceites s/p",
  "aceites-con-proteina": "Aceites c/p",
  "azucares-sin-grasa": "Azúcares s/g",
  "azucares-con-grasa": "Azúcares c/g",
};

export interface GroupNutritionProfile {
  readonly kcal: number;
  readonly proteinG: number;
  readonly carbsG: number;
  readonly fatG: number;
}

/**
 * Macronutrientes por equivalente (ración) según SMAE 5ª edición.
 * Cada grupo tiene su propio perfil nutrimental canónico.
 */
export const GroupNutrition: Record<FoodGroup, GroupNutritionProfile> = {
  verduras: { kcal: 25, proteinG: 2, carbsG: 5, fatG: 0 },
  frutas: { kcal: 60, proteinG: 0, carbsG: 15, fatG: 0 },
  "cereales-sin-grasa": { kcal: 70, proteinG: 2, carbsG: 15, fatG: 0 },
  "cereales-con-grasa": { kcal: 70, proteinG: 2, carbsG: 15, fatG: 1 },
  leguminosas: { kcal: 80, proteinG: 4, carbsG: 14, fatG: 0.5 },
  "aoa-muy-bajo": { kcal: 40, proteinG: 7, carbsG: 0, fatG: 1 },
  "aoa-bajo": { kcal: 55, proteinG: 7, carbsG: 0, fatG: 2.5 },
  "aoa-moderado": { kcal: 75, proteinG: 7, carbsG: 0, fatG: 5 },
  "aoa-alto": { kcal: 100, proteinG: 7, carbsG: 0, fatG: 8 },
  "leche-entera": { kcal: 150, proteinG: 8, carbsG: 12, fatG: 8 },
  "leche-semidescremada": { kcal: 110, proteinG: 8, carbsG: 12, fatG: 2.5 },
  "leche-descremada": { kcal: 80, proteinG: 8, carbsG: 12, fatG: 0 },
  "aceites-sin-proteina": { kcal: 45, proteinG: 0, carbsG: 0, fatG: 5 },
  "aceites-con-proteina": { kcal: 55, proteinG: 2, carbsG: 1, fatG: 5 },
  "azucares-sin-grasa": { kcal: 40, proteinG: 0, carbsG: 10, fatG: 0 },
  "azucares-con-grasa": { kcal: 85, proteinG: 1, carbsG: 13, fatG: 4 },
};

export interface KcalMatch {
  group: FoodGroup;
  kcal: number;
  delta: number;
}

/**
 * Equivalencia inversa por grupo: dado un kcal target, devuelve los
 * grupos cuya ración cae dentro de la tolerancia, ordenados por
 * menor delta (mejor equivalente).
 *
 * Sirve para "¿qué grupo me da ~70 kcal por ración?" → cereales.
 */
export const findGroupsByKcal = (
  targetKcal: number,
  toleranceKcal: number,
): KcalMatch[] => {
  if (targetKcal <= 0) return [];
  if (toleranceKcal < 0) throw new Error("La tolerancia no puede ser negativa.");
  return FOOD_GROUPS.map((group) => ({
    group,
    kcal: GroupNutrition[group].kcal,
    delta: Math.abs(GroupNutrition[group].kcal - targetKcal),
  }))
    .filter((m) => m.delta <= toleranceKcal)
    .sort((a, b) => a.delta - b.delta);
};
