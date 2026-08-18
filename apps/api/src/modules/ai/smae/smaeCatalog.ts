import { z } from 'zod';

/**
 * Catálogo SMAE 5ª edición (lado servidor).
 *
 * Fuente autoritativa del contenido: el catálogo del cliente
 * (src/modules/smae/domain/FoodGroup.ts y SYSTEM_FOODS.ts). Este módulo es el
 * espejo determinista validado en el servidor para calcular equivalentes,
 * validar planes y sugerir sustituciones SIN depender del conocimiento del LLM.
 *
 * Arquitectura de catálogo incremental (NUNCA cerrado):
 *  - El contenido del catálogo es DATA: entra por `loadSmaeCatalog` y se valida
 *    fail-closed (ítem inválido ⇒ el catálogo completo se rechaza, nunca se
 *    calcula con datos malformados).
 *  - El motor (smaeEngine) es código: procesa cualquier catálogo válido sin
 *    cambios de lógica por alimento. Agregar un alimento nuevo del SMAE NO
 *    requiere tocar el motor.
 *  - Versiones separadas: SMAE_ENGINE_VERSION (algoritmo) vs
 *    SMAE_CATALOG_VERSION (contenido, derivado de un fingerprint determinista).
 *  - Cualquier cambio de contenido (agregar/desactivar ítems) cambia el
 *    fingerprint/versión; el fingerprint se usa en provenance/evidencia y en la
 *    clave exacta de certificación (ver certification/versions.ts).
 */

export const SMAE_ENGINE_VERSION = 'smae-engine-v1';

/** Etiqueta semántica de la fuente (edición SMAE), independiente del fingerprint. */
export const SMAE_CATALOG_SOURCE_LABEL = 'smae-5a-edicion';

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

/**
 * Estado de un ítem del catálogo:
 *  - active: válido, participa en búsquedas, sustituciones y validación.
 *  - inactive: válido pero desactivado (no participa; se conserva con
 *    trazabilidad y sigue contando en el fingerprint del catálogo).
 * Los ítems malformados NO EXISTEN en el catálogo: `loadSmaeCatalog` falla
 * fail-closed si un ítem no pasa validación (nunca se calcula con basura).
 */
export type CatalogItemStatus = 'active' | 'inactive';

export interface SmaeFood {
  readonly id: string;
  readonly group: FoodGroup;
  readonly name: string;
  readonly shortName: string;
  readonly serving: string;
  readonly servingGrams: number;
  readonly keywords: readonly string[];
  readonly nutrition: GroupNutritionProfile;
  readonly status: CatalogItemStatus;
}

export interface SmaeCatalogItemInput {
  id: string;
  group: FoodGroup;
  name: string;
  shortName: string;
  serving: string;
  servingGrams: number;
  keywords?: readonly string[];
  nutrition: GroupNutritionProfile;
  status?: CatalogItemStatus;
}

const SmaeCatalogItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'id inválido (solo minúsculas, dígitos y guiones)'),
  group: FoodGroupSchema,
  name: z.string().min(1, 'nombre vacío'),
  shortName: z.string().min(1, 'nombre corto vacío'),
  serving: z.string().min(1, 'ración vacía'),
  servingGrams: z.number().positive('ración en gramos debe ser positiva'),
  keywords: z.array(z.string().min(1)).default([]),
  nutrition: z.object({
    kcal: z.number().nonnegative('kcal no puede ser negativa'),
    proteinG: z.number().nonnegative('proteína no puede ser negativa'),
    carbsG: z.number().nonnegative('CHO no puede ser negativo'),
    fatG: z.number().nonnegative('grasa no puede ser negativa'),
  }),
  status: z.enum(['active', 'inactive']).default('active'),
});

export type SmaeCatalogValidation = { ok: true; item: SmaeFood } | { ok: false; errors: string[] };

/** Valida un ítem candidato del catálogo. Los ítems inválidos NUNCA entran activos. */
export function validateSmaeCatalogItem(input: unknown): SmaeCatalogValidation {
  const parsed = SmaeCatalogItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) };
  }
  return { ok: true, item: { ...parsed.data, nutrition: parsed.data.nutrition } };
}

export interface SmaeCatalog {
  readonly version: string;
  readonly fingerprint: string;
  readonly engineVersion: string;
  readonly sourceLabel: string;
  readonly entries: readonly SmaeFood[];
}

function canonicalLine(food: SmaeFood): string {
  const keywords = [...food.keywords].slice().sort().join(',');
  return [
    food.id,
    food.group,
    food.status,
    food.servingGrams,
    food.nutrition.kcal,
    food.nutrition.proteinG,
    food.nutrition.carbsG,
    food.nutrition.fatG,
    food.name,
    food.shortName,
    food.serving,
    keywords,
  ].join('|');
}

/** Fingerprint FNV-1a determinista del contenido del catálogo (orden canónico por id). */
export function computeSmaeCatalogFingerprint(entries: readonly SmaeFood[]): string {
  const canonical = entries
    .map(canonicalLine)
    .sort()
    .join('\n');
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Carga y valida un catálogo completo. FAIL CLOSED: cualquier ítem inválido o
 * id duplicado rechaza el catálogo entero (nunca se calcula con datos
 * malformados). La versión del catálogo deriva del fingerprint del contenido.
 */
export function loadSmaeCatalog(inputs: readonly SmaeCatalogItemInput[]): SmaeCatalog {
  const entries: SmaeFood[] = [];
  const seen = new Set<string>();
  for (const input of inputs) {
    const validation = validateSmaeCatalogItem(input);
    if (!validation.ok) {
      throw new Error(`Catálogo SMAE inválido (fail-closed): ítem '${String((input as { id?: unknown })?.id ?? '?')}' → ${validation.errors.join('; ')}`);
    }
    if (seen.has(validation.item.id)) {
      throw new Error(`Catálogo SMAE inválido (fail-closed): id duplicado '${validation.item.id}'`);
    }
    seen.add(validation.item.id);
    entries.push(validation.item);
  }
  const fingerprint = computeSmaeCatalogFingerprint(entries);
  return {
    version: `smae-catalog-${fingerprint}`,
    fingerprint,
    engineVersion: SMAE_ENGINE_VERSION,
    sourceLabel: SMAE_CATALOG_SOURCE_LABEL,
    entries,
  };
}

export function activeEntries(catalog: SmaeCatalog): readonly SmaeFood[] {
  return catalog.entries.filter((food) => food.status === 'active');
}

const RAW_SYSTEM_FOODS: ReadonlyArray<Omit<SmaeFood, 'nutrition' | 'status'>> = [
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

/**
 * Catálogo de producción: carga validada de la fuente canónica (paridad con
 * SYSTEM_FOODS.ts). 37 ítems activos hoy; el catálogo es incremental (18.1).
 */
export const SMAE_CATALOG: SmaeCatalog = loadSmaeCatalog(
  RAW_SYSTEM_FOODS.map((food) => ({ ...food, nutrition: GroupNutrition[food.group], status: 'active' as const })),
);

/** Versión derivada del fingerprint determinista del contenido actual. */
export const SMAE_CATALOG_VERSION: string = SMAE_CATALOG.version;

/** Alimentos activos del catálogo de producción (compatibilidad y paridad). */
export const SYSTEM_FOODS: readonly SmaeFood[] = activeEntries(SMAE_CATALOG);

export function getSmaeFoodById(id: string, catalog: SmaeCatalog = SMAE_CATALOG): SmaeFood | null {
  return activeEntries(catalog).find((food) => food.id === id) ?? null;
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function searchSmaeFoods(query: string, catalog: SmaeCatalog = SMAE_CATALOG): SmaeFood[] {
  const q = normalizeText(query.trim());
  if (!q) return [];
  return activeEntries(catalog).filter((food) => {
    const haystack = [food.name, food.shortName, ...food.keywords].map(normalizeText);
    return haystack.some((h) => h.includes(q));
  });
}