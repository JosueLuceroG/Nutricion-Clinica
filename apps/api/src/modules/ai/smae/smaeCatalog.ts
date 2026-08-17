import { z } from 'zod';

/**
 * Catálogo SMAE 5ª edición (lado servidor).
 *
 * Espejo determinista de la fuente canónica del cliente
 * (src/modules/smae/domain/FoodGroup.ts y SYSTEM_FOODS.ts) para que el
 * servidor pueda validar planes, calcular equivalentes y sugerir
 * sustituciones SIN depender del conocimiento del LLM.
 *
 * Reglas:
 *  - Los valores nutrimentales son los del SMAE 5ª edición (inmutables).
 *  - Cualquier cambio al catálogo requiere incrementar SMAE_CATALOG_VERSION
 *    (invalida certificaciones por toolset/provenance).
 */

export const SMAE_CATALOG_VERSION = 'smae-5a-v1';

export const FoodGroupSchema = z.enum([
  'verduras',
  'frutas',
  'cereales-sin-grasa',
  'cereales-con-grasa',
  'leguminosas',
  'aoa-muy-bajo',
  'aoa-bajo',
  'aoa-moderado',
  'aoa-alto',
  'leche-entera',
  'leche-semidescremada',
  'leche-descremada',
  'aceites-sin-proteina',
  'aceites-con-proteina',
  'azucares-sin-grasa',
  'azucares-con-grasa',
]);

export type FoodGroup = z.infer<typeof FoodGroupSchema>;

export const FOOD_GROUPS: readonly FoodGroup[] = FoodGroupSchema.options;

export interface GroupNutritionProfile {
  readonly kcal: number;
  readonly proteinG: number;
  readonly carbsG: number;
  readonly fatG: number;
}

export const GroupNutrition: Record<FoodGroup, GroupNutritionProfile> = {
  verduras: { kcal: 25, proteinG: 2, carbsG: 5, fatG: 0 },
  frutas: { kcal: 60, proteinG: 0, carbsG: 15, fatG: 0 },
  'cereales-sin-grasa': { kcal: 70, proteinG: 2, carbsG: 15, fatG: 0 },
  'cereales-con-grasa': { kcal: 70, proteinG: 2, carbsG: 15, fatG: 1 },
  leguminosas: { kcal: 80, proteinG: 4, carbsG: 14, fatG: 0.5 },
  'aoa-muy-bajo': { kcal: 40, proteinG: 7, carbsG: 0, fatG: 1 },
  'aoa-bajo': { kcal: 55, proteinG: 7, carbsG: 0, fatG: 2.5 },
  'aoa-moderado': { kcal: 75, proteinG: 7, carbsG: 0, fatG: 5 },
  'aoa-alto': { kcal: 100, proteinG: 7, carbsG: 0, fatG: 8 },
  'leche-entera': { kcal: 150, proteinG: 8, carbsG: 12, fatG: 8 },
  'leche-semidescremada': { kcal: 110, proteinG: 8, carbsG: 12, fatG: 2.5 },
  'leche-descremada': { kcal: 80, proteinG: 8, carbsG: 12, fatG: 0 },
  'aceites-sin-proteina': { kcal: 45, proteinG: 0, carbsG: 0, fatG: 5 },
  'aceites-con-proteina': { kcal: 55, proteinG: 2, carbsG: 1, fatG: 5 },
  'azucares-sin-grasa': { kcal: 40, proteinG: 0, carbsG: 10, fatG: 0 },
  'azucares-con-grasa': { kcal: 85, proteinG: 1, carbsG: 13, fatG: 4 },
};

export const FoodGroupLabel: Record<FoodGroup, string> = {
  verduras: 'Verduras',
  frutas: 'Frutas',
  'cereales-sin-grasa': 'Cereales sin grasa',
  'cereales-con-grasa': 'Cereales con grasa',
  leguminosas: 'Leguminosas',
  'aoa-muy-bajo': 'AOA · Muy bajo aporte de grasa',
  'aoa-bajo': 'AOA · Bajo aporte de grasa',
  'aoa-moderado': 'AOA · Moderado aporte de grasa',
  'aoa-alto': 'AOA · Alto aporte de grasa',
  'leche-entera': 'Leche entera',
  'leche-semidescremada': 'Leche semidescremada',
  'leche-descremada': 'Leche descremada',
  'aceites-sin-proteina': 'Aceites sin proteína',
  'aceites-con-proteina': 'Aceites con proteína',
  'azucares-sin-grasa': 'Azúcares sin grasa',
  'azucares-con-grasa': 'Azúcares con grasa',
};

export interface SmaeFood {
  id: string;
  group: FoodGroup;
  name: string;
  shortName: string;
  serving: string;
  servingGrams: number;
  keywords: readonly string[];
  nutrition: GroupNutritionProfile;
}

const RAW_SYSTEM_FOODS: ReadonlyArray<Omit<SmaeFood, 'nutrition'>> = [
  { id: 'verdura-acelga', group: 'verduras', name: 'Acelga', shortName: 'Acelga', serving: '1 taza de hojas crudas', servingGrams: 50, keywords: ['hoja', 'verde', 'cocida', 'vegetal'] },
  { id: 'verdura-brocoli', group: 'verduras', name: 'Brócoli', shortName: 'Brócoli', serving: '1 taza de floretes cocidos', servingGrams: 90, keywords: ['florete', 'verde', 'cocido', 'vegetal'] },
  { id: 'verdura-espinaca', group: 'verduras', name: 'Espinaca', shortName: 'Espinaca', serving: '1 taza de hojas crudas', servingGrams: 50, keywords: ['hoja', 'verde', 'cocida', 'vegetal'] },
  { id: 'verdura-jitomate', group: 'verduras', name: 'Jitomate', shortName: 'Jitomate', serving: '1 pieza mediana', servingGrams: 120, keywords: ['rojo', 'tomate', 'ensalada', 'vegetal'] },
  { id: 'verdura-zanahoria', group: 'verduras', name: 'Zanahoria', shortName: 'Zanahoria', serving: '1/2 taza picada', servingGrams: 60, keywords: ['naranja', 'cruda', 'cocida', 'vegetal'] },
  { id: 'verdura-nopales', group: 'verduras', name: 'Nopales', shortName: 'Nopales', serving: '1 taza cocida', servingGrams: 100, keywords: ['mexicano', 'asado', 'verde', 'vegetal'] },
  { id: 'verdura-calabacita', group: 'verduras', name: 'Calabacita', shortName: 'Calabacita', serving: '1 taza cocida', servingGrams: 100, keywords: ['calabaza', 'verde', 'cocida', 'vegetal'] },
  { id: 'fruta-manzana', group: 'frutas', name: 'Manzana', shortName: 'Manzana', serving: '1 pieza mediana', servingGrams: 130, keywords: ['roja', 'verde', 'cruda'] },
  { id: 'fruta-platano', group: 'frutas', name: 'Plátano', shortName: 'Plátano', serving: '1/2 pieza mediana', servingGrams: 70, keywords: ['maduro', 'tropical', 'energia'] },
  { id: 'fruta-naranja', group: 'frutas', name: 'Naranja', shortName: 'Naranja', serving: '1 pieza mediana', servingGrams: 130, keywords: ['citrica', 'jugo', 'vitamina c'] },
  { id: 'fruta-papaya', group: 'frutas', name: 'Papaya', shortName: 'Papaya', serving: '1 taza picada', servingGrams: 140, keywords: ['tropical', 'digestiva', 'mexicana'] },
  { id: 'fruta-fresa', group: 'frutas', name: 'Fresa', shortName: 'Fresa', serving: '1 taza entera', servingGrams: 150, keywords: ['roja', 'dulce', 'temporada'] },
  { id: 'fruta-mango', group: 'frutas', name: 'Mango', shortName: 'Mango', serving: '1/2 pieza', servingGrams: 100, keywords: ['tropical', 'maduro', 'mexicano'] },
  { id: 'cereal-tortilla-maiz', group: 'cereales-sin-grasa', name: 'Tortilla de maíz', shortName: 'Tortilla', serving: '1 pieza (30g)', servingGrams: 30, keywords: ['maiz', 'mexicana', 'antojo', 'basica', 'gluten'] },
  { id: 'cereal-arroz', group: 'cereales-sin-grasa', name: 'Arroz blanco cocido', shortName: 'Arroz', serving: '1/3 taza', servingGrams: 60, keywords: ['blanco', 'cocido', 'guarnicion'] },
  { id: 'cereal-pan-blanco', group: 'cereales-sin-grasa', name: 'Pan blanco', shortName: 'Pan blanco', serving: '1 rebanada (25g)', servingGrams: 25, keywords: ['rebanada', 'basico', 'desayuno', 'gluten', 'trigo'] },
  { id: 'cereal-avena', group: 'cereales-sin-grasa', name: 'Avena', shortName: 'Avena', serving: '1/3 taza cruda', servingGrams: 27, keywords: ['hojuela', 'fibra', 'desayuno', 'gluten'] },
  { id: 'cereal-papa', group: 'cereales-sin-grasa', name: 'Papa cocida', shortName: 'Papa', serving: '1/2 pieza', servingGrams: 80, keywords: ['cocida', 'pure', 'guarnicion'] },
  { id: 'cereal-bolillo', group: 'cereales-con-grasa', name: 'Bolillo', shortName: 'Bolillo', serving: '1/3 pieza (25g)', servingGrams: 25, keywords: ['pan', 'mexicano', 'tortas', 'gluten', 'trigo'] },
  { id: 'cereal-pan-tostado', group: 'cereales-con-grasa', name: 'Pan tostado', shortName: 'Pan tostado', serving: '1 rebanada', servingGrams: 25, keywords: ['crujiente', 'desayuno', 'gluten', 'trigo'] },
  { id: 'legum-frijol', group: 'leguminosas', name: 'Frijol cocido', shortName: 'Frijol', serving: '1/2 taza', servingGrams: 90, keywords: ['negro', 'mexicano', 'basico', 'proteina'] },
  { id: 'legum-lenteja', group: 'leguminosas', name: 'Lenteja cocida', shortName: 'Lenteja', serving: '1/2 taza', servingGrams: 90, keywords: ['proteina', 'hierro', 'sopa'] },
  { id: 'legum-garbanzo', group: 'leguminosas', name: 'Garbanzo cocido', shortName: 'Garbanzo', serving: '1/2 taza', servingGrams: 90, keywords: ['proteina', 'mediterraneo', 'ensalada'] },
  { id: 'aoa-pechuga-pollo', group: 'aoa-muy-bajo', name: 'Pechuga de pollo sin piel', shortName: 'Pechuga pollo', serving: '30 g', servingGrams: 30, keywords: ['pollo', 'proteina', 'magra', 'plancha'] },
  { id: 'aoa-pescado-blanco', group: 'aoa-muy-bajo', name: 'Pescado blanco (tilapia, huachinango)', shortName: 'Pescado', serving: '30 g', servingGrams: 30, keywords: ['tilapia', 'huachinango', 'proteina', 'omega'] },
  { id: 'aoa-huevo', group: 'aoa-bajo', name: 'Huevo entero', shortName: 'Huevo', serving: '1 pieza (50g)', servingGrams: 50, keywords: ['proteina', 'desayuno', 'basico', 'huevo'] },
  { id: 'aoa-queso-panela', group: 'aoa-bajo', name: 'Queso panela', shortName: 'Queso panela', serving: '30 g', servingGrams: 30, keywords: ['queso', 'fresco', 'mexicano'] },
  { id: 'aoa-bistec-res', group: 'aoa-moderado', name: 'Bistec de res', shortName: 'Bistec res', serving: '30 g', servingGrams: 30, keywords: ['res', 'plancha', 'hierro'] },
  { id: 'aoa-queso-amarillo', group: 'aoa-alto', name: 'Queso amarillo', shortName: 'Queso amarillo', serving: '30 g', servingGrams: 30, keywords: ['queso', 'procesado', 'graso'] },
  { id: 'leche-descremada', group: 'leche-descremada', name: 'Leche descremada', shortName: 'Leche desc.', serving: '1 taza (240ml)', servingGrams: 240, keywords: ['light', 'baja en grasa', 'calcio', 'leche', 'lactosa'] },
  { id: 'leche-semidescremada', group: 'leche-semidescremada', name: 'Leche semidescremada', shortName: 'Leche semi.', serving: '1 taza (240ml)', servingGrams: 240, keywords: ['media grasa', 'calcio', 'leche', 'lactosa'] },
  { id: 'leche-entera', group: 'leche-entera', name: 'Leche entera', shortName: 'Leche entera', serving: '1 taza (240ml)', servingGrams: 240, keywords: ['completa', 'calcio', 'ninos', 'leche', 'lactosa'] },
  { id: 'aceite-oliva', group: 'aceites-sin-proteina', name: 'Aceite de oliva', shortName: 'Aceite oliva', serving: '1 cucharadita (5ml)', servingGrams: 5, keywords: ['extra virgen', 'mediterraneo', 'grasa buena'] },
  { id: 'aceite-aguacate', group: 'aceites-sin-proteina', name: 'Aguacate', shortName: 'Aguacate', serving: '1/3 pieza mediana', servingGrams: 35, keywords: ['mexicano', 'grasa buena', 'guacamole'] },
  { id: 'aceite-nueces', group: 'aceites-con-proteina', name: 'Nueces', shortName: 'Nueces', serving: '1 cucharada (10g)', servingGrams: 10, keywords: ['nuez', 'nueces', 'omega 3', 'fruto seco', 'arbol'] },
  { id: 'azucar-miel', group: 'azucares-sin-grasa', name: 'Miel de abeja', shortName: 'Miel', serving: '2 cucharaditas', servingGrams: 10, keywords: ['endulzante', 'natural'] },
  { id: 'azucar-chocolate', group: 'azucares-con-grasa', name: 'Chocolate amargo (70%)', shortName: 'Chocolate', serving: '1 cuadrito (10g)', servingGrams: 10, keywords: ['amargo', 'cacao', 'antojo'] },
];

export const SYSTEM_FOODS: readonly SmaeFood[] = RAW_SYSTEM_FOODS.map((food) => ({
  ...food,
  nutrition: GroupNutrition[food.group],
}));

const FOOD_MAP = new Map<string, SmaeFood>(SYSTEM_FOODS.map((food) => [food.id, food]));

export function getSmaeFoodById(id: string): SmaeFood | null {
  return FOOD_MAP.get(id) ?? null;
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function searchSmaeFoods(query: string): SmaeFood[] {
  const q = normalizeText(query.trim());
  if (!q) return [];
  return SYSTEM_FOODS.filter((food) => {
    const haystack = [food.name, food.shortName, ...food.keywords].map(normalizeText);
    return haystack.some((h) => h.includes(q));
  });
}