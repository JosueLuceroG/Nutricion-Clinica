import { FOOD_GROUPS, FoodGroupLabel, FoodGroupSchema, GroupNutrition, SMAE_CATALOG, activeEntries, type FoodGroup, type GroupNutritionProfile, type SmaeCatalog, type SmaeFood } from './smaeCatalog.js';

/**
 * Motor SMAE determinista (lado servidor).
 *
 * Reglas:
 *  - Toda operación es determinista: mismos inputs → mismos outputs.
 *  - El LLM nunca calcula equivalentes ni valida planes; solo interpreta
 *    los resultados de este motor.
 *  - Un grupo desconocido es un error de validación (nunca se infiere).
 *  - El motor es DATA-DRIVEN: opera sobre cualquier catálogo válido
 *    (SmaeCatalog); el contenido nunca se ramifica en el código del motor.
 *    Agregar un alimento nuevo NO requiere cambios de lógica (18.2/18.4).
 *  - Las funciones aceptan `catalog` (por defecto el catálogo de producción);
 *    cada resultado reporta catalog.version (fingerprint) y engineVersion.
 */

export interface ExchangeEntry {
  foodId: string | null;
  foodName: string;
  group: FoodGroup;
  groupLabel: string;
  portions: number;
  nutrition: GroupNutritionProfile;
}

export interface ExchangeSummary {
  catalogVersion: string;
  engineVersion: string;
  entries: ExchangeEntry[];
  totals: { kcal: number; proteinG: number; carbsG: number; fatG: number };
  exchangesByGroup: Record<string, number>;
}

export interface MealPlanTargets {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MealPlanIssue {
  code: 'UNKNOWN_FOOD' | 'UNKNOWN_GROUP' | 'INVALID_PORTIONS' | 'TARGET_DEVIATION' | 'NO_TARGETS';
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface MealPlanValidation {
  ok: boolean;
  catalogVersion: string;
  engineVersion: string;
  summary: ExchangeSummary | null;
  issues: MealPlanIssue[];
  deviations: { kcalPct: number; proteinPct: number; carbsPct: number; fatPct: number } | null;
}

export interface PlanMealItem {
  foodId?: string;
  foodName?: string;
  group?: string;
  portions?: number;
  /** Vista previa opcional que el LLM no debe usar como fuente de cálculo. */
  [key: string]: unknown;
}

function groupOf(value: string): FoodGroup | null {
  const parsed = FoodGroupSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function normalizePortions(value: unknown): number | null {
  const num = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : undefined;
  return num !== undefined && !Number.isNaN(num) && num > 0 ? num : null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function nutritionTimes(nutrition: GroupNutritionProfile, portions: number): GroupNutritionProfile {
  return { kcal: round1(nutrition.kcal * portions), proteinG: round1(nutrition.proteinG * portions), carbsG: round1(nutrition.carbsG * portions), fatG: round1(nutrition.fatG * portions) };
}

/** Convierte los ítems de un plan (meals_json) en un resumen de equivalentes por grupo. */
export function summarizeExchanges(items: PlanMealItem[], catalog: SmaeCatalog = SMAE_CATALOG): ExchangeSummary {
  const entries: ExchangeEntry[] = [];
  const exchangesByGroup: Record<string, number> = {};
  const totals = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  const activeFoods = activeEntries(catalog);

  for (const item of items) {
    const group = typeof item.group === 'string' ? groupOf(item.group) : null;
    if (!group) continue;
    const portions = normalizePortions(item.portions);
    if (portions === null) continue;
    const food = typeof item.foodId === 'string' ? activeFoods.find((f) => f.id === item.foodId) : undefined;
    const nutrition = nutritionTimes(GroupNutrition[group], portions);
    totals.kcal += nutrition.kcal;
    totals.proteinG += nutrition.proteinG;
    totals.carbsG += nutrition.carbsG;
    totals.fatG += nutrition.fatG;
    exchangesByGroup[group] = (exchangesByGroup[group] ?? 0) + portions;
    entries.push({
      foodId: food?.id ?? null,
      foodName: food?.name ?? (typeof item.foodName === 'string' ? item.foodName : 'Alimento del plan'),
      group,
      groupLabel: GroupNutritionLabel(group),
      portions,
      nutrition,
    });
  }

  const roundedTotals = { kcal: round1(totals.kcal), proteinG: round1(totals.proteinG), carbsG: round1(totals.carbsG), fatG: round1(totals.fatG) };
  return { catalogVersion: catalog.version, engineVersion: catalog.engineVersion, entries, totals: roundedTotals, exchangesByGroup };
}

export function GroupNutritionLabel(group: FoodGroup): string {
  return FoodGroupLabel[group];
}

/**
 * Valida un plan contra el catálogo SMAE y los objetivos del plan.
 * Determinista y sin LLM. Devuelve issues con severidad; `ok` solo cuando
 * no hay errores (grupos/porciones inválidos) aunque haya advertencias.
 */
export function validateMealPlan(items: PlanMealItem[], targets?: MealPlanTargets, tolerancePct = 10, catalog: SmaeCatalog = SMAE_CATALOG): MealPlanValidation {
  const issues: MealPlanIssue[] = [];
  const activeFoods = activeEntries(catalog);

  for (const item of items) {
    const group = typeof item.group === 'string' ? groupOf(item.group) : null;
    if (!group) {
      issues.push({ code: 'UNKNOWN_GROUP', severity: 'error', message: `Grupo desconocido en el plan: '${String(item.group ?? '(sin grupo)')}'` });
      continue;
    }
    if (normalizePortions(item.portions) === null) {
      issues.push({ code: 'INVALID_PORTIONS', severity: 'error', message: `Porciones inválidas para el ítem '${String(item.foodName ?? item.group)}'` });
      continue;
    }
    if (typeof item.foodId === 'string' && !activeFoods.some((f) => f.id === item.foodId)) {
      issues.push({ code: 'UNKNOWN_FOOD', severity: 'warning', message: `Alimento '${item.foodId}' sin equivalencia validada en el catálogo SMAE (SMAE_ITEM_NOT_FOUND; puede ser un alimento custom del cliente)` });
    }
  }

  const summary = summarizeExchanges(items, catalog);

  if (!targets) {
    return { ok: issues.every((i) => i.severity !== 'error'), catalogVersion: catalog.version, engineVersion: catalog.engineVersion, summary, issues: [...issues, { code: 'NO_TARGETS', severity: 'info', message: 'El plan no declara objetivos calóricos/macros' }], deviations: null };
  }

  const pct = (actual: number, target: number): number => (target > 0 ? (actual - target) / target : 0);
  const deviations = {
    kcalPct: round1(pct(summary.totals.kcal, targets.kcal) * 100),
    proteinPct: round1(pct(summary.totals.proteinG, targets.proteinG) * 100),
    carbsPct: round1(pct(summary.totals.carbsG, targets.carbsG) * 100),
    fatPct: round1(pct(summary.totals.fatG, targets.fatG) * 100),
  };
  for (const [label, key] of [['kcal', 'kcalPct'], ['proteína', 'proteinPct'], ['carbohidratos', 'carbsPct'], ['grasa', 'fatPct']] as const) {
    const deviation = Math.abs(deviations[key]);
    if (deviation > tolerancePct) {
      issues.push({ code: 'TARGET_DEVIATION', severity: 'warning', message: `Desviación de ${label} ${deviations[key]}% (tolerancia ${tolerancePct}%)` });
    }
  }

  return { ok: issues.every((i) => i.severity !== 'error'), catalogVersion: catalog.version, engineVersion: catalog.engineVersion, summary, issues, deviations };
}

export interface SubstitutionConstraint {
  allergenTexts: string[];
  intoleranceTexts: string[];
}

/**
 * Sustituciones dentro del MISMO grupo SMAE. Filtra por alergias e
 * intolerancias (coincidencia acento/uso-insensible en nombre y keywords).
 * Si un alimento no coincide con el catálogo (o está inactivo), devuelve
 * vacío y `unmatched` (SMAE_ITEM_NOT_FOUND: el LLM nunca inventa equivalentes).
 */
export function suggestSubstitutions(foodId: string, constraints?: SubstitutionConstraint, catalog: SmaeCatalog = SMAE_CATALOG): { candidates: SmaeFood[]; unmatched: boolean } {
  const active = activeEntries(catalog);
  const food = active.find((f) => f.id === foodId);
  if (!food) return { candidates: [], unmatched: true };
  const blockTexts = [...(constraints?.allergenTexts ?? []), ...(constraints?.intoleranceTexts ?? [])]
    .map((text) => normalizeLower(text))
    .filter((text) => text.length > 0);
  const candidates = active.filter((candidate) => {
    if (candidate.id === food.id) return false;
    if (candidate.group !== food.group) return false;
    if (blockTexts.length === 0) return true;
    const candidateText = normalizeLower([candidate.name, candidate.shortName, ...candidate.keywords].join(' '));
    return !blockTexts.some((block) => candidateText.includes(block));
  });
  return { candidates, unmatched: false };
}

function normalizeLower(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export interface KcalMatch {
  group: FoodGroup;
  kcal: number;
  delta: number;
}

/** Equivalencia inversa por grupo: grupos cuya ración cae dentro de la tolerancia de kcal. */
export function findGroupsByKcal(targetKcal: number, toleranceKcal: number): KcalMatch[] {
  if (targetKcal <= 0) return [];
  if (toleranceKcal < 0) throw new Error('La tolerancia no puede ser negativa.');
  return FOOD_GROUPS.map((group) => ({
    group,
    kcal: GroupNutrition[group].kcal,
    delta: Math.abs(GroupNutrition[group].kcal - targetKcal),
  }))
    .filter((m) => m.delta <= toleranceKcal)
    .sort((a, b) => a.delta - b.delta);
}