import { describe, expect, it } from 'vitest';
import { GroupNutrition, SMAE_CATALOG_VERSION, SYSTEM_FOODS, FOOD_GROUPS, getSmaeFoodById, searchSmaeFoods } from './smaeCatalog.js';
import { findGroupsByKcal, summarizeExchanges, suggestSubstitutions, validateMealPlan } from './smaeEngine.js';

describe('SMAE catalog (paridad con fuente canónica SMAE 5ª)', () => {
  it('define las 16 categorías canónicas del SMAE 5ª edición', () => {
    expect(FOOD_GROUPS).toEqual([
      'verduras', 'frutas', 'cereales-sin-grasa', 'cereales-con-grasa', 'leguminosas',
      'aoa-muy-bajo', 'aoa-bajo', 'aoa-moderado', 'aoa-alto',
      'leche-entera', 'leche-semidescremada', 'leche-descremada',
      'aceites-sin-proteina', 'aceites-con-proteina', 'azucares-sin-grasa', 'azucares-con-grasa',
    ]);
  });

  it('valores nutrimentales por equivalente idénticos a la fuente canónica del cliente (FoodGroup.ts)', () => {
    expect(GroupNutrition['verduras']).toEqual({ kcal: 25, proteinG: 2, carbsG: 5, fatG: 0 });
    expect(GroupNutrition['frutas']).toEqual({ kcal: 60, proteinG: 0, carbsG: 15, fatG: 0 });
    expect(GroupNutrition['cereales-sin-grasa']).toEqual({ kcal: 70, proteinG: 2, carbsG: 15, fatG: 0 });
    expect(GroupNutrition['cereales-con-grasa']).toEqual({ kcal: 70, proteinG: 2, carbsG: 15, fatG: 1 });
    expect(GroupNutrition['leguminosas']).toEqual({ kcal: 80, proteinG: 4, carbsG: 14, fatG: 0.5 });
    expect(GroupNutrition['aoa-muy-bajo']).toEqual({ kcal: 40, proteinG: 7, carbsG: 0, fatG: 1 });
    expect(GroupNutrition['aoa-bajo']).toEqual({ kcal: 55, proteinG: 7, carbsG: 0, fatG: 2.5 });
    expect(GroupNutrition['aoa-moderado']).toEqual({ kcal: 75, proteinG: 7, carbsG: 0, fatG: 5 });
    expect(GroupNutrition['aoa-alto']).toEqual({ kcal: 100, proteinG: 7, carbsG: 0, fatG: 8 });
    expect(GroupNutrition['leche-entera']).toEqual({ kcal: 150, proteinG: 8, carbsG: 12, fatG: 8 });
    expect(GroupNutrition['leche-semidescremada']).toEqual({ kcal: 110, proteinG: 8, carbsG: 12, fatG: 2.5 });
    expect(GroupNutrition['leche-descremada']).toEqual({ kcal: 80, proteinG: 8, carbsG: 12, fatG: 0 });
    expect(GroupNutrition['aceites-sin-proteina']).toEqual({ kcal: 45, proteinG: 0, carbsG: 0, fatG: 5 });
    expect(GroupNutrition['aceites-con-proteina']).toEqual({ kcal: 55, proteinG: 2, carbsG: 1, fatG: 5 });
    expect(GroupNutrition['azucares-sin-grasa']).toEqual({ kcal: 40, proteinG: 0, carbsG: 10, fatG: 0 });
    expect(GroupNutrition['azucares-con-grasa']).toEqual({ kcal: 85, proteinG: 1, carbsG: 13, fatG: 4 });
  });

  it('catálogo de alimentos del sistema con ración y gramaje (37, paridad total con SYSTEM_FOODS.ts)', () => {
    expect(SYSTEM_FOODS.length).toBe(37);
    for (const food of SYSTEM_FOODS) {
      expect(food.id).toMatch(/^[a-z0-9-]+$/);
      expect(FOOD_GROUPS).toContain(food.group);
      expect(food.servingGrams).toBeGreaterThan(0);
      expect(food.nutrition).toEqual(GroupNutrition[food.group]);
    }
    expect(getSmaeFoodById('cereal-tortilla-maiz')?.name).toBe('Tortilla de maíz');
    expect(getSmaeFoodById('no-existe')).toBeNull();
  });

  it('búsqueda acento-insensible por nombre y keywords', () => {
    expect(searchSmaeFoods('platano').some((f) => f.id === 'fruta-platano')).toBe(true);
    expect(searchSmaeFoods('PLATANO').some((f) => f.id === 'fruta-platano')).toBe(true);
    expect(searchSmaeFoods('lactosa').some((f) => f.id === 'leche-entera')).toBe(true);
    expect(searchSmaeFoods('xyz').length).toBe(0);
  });
});

describe('SMAE engine', () => {
  it('sumariza equivalentes por grupo y totaliza macros', () => {
    const summary = summarizeExchanges([
      { foodId: 'cereal-tortilla-maiz', foodName: 'Tortilla', group: 'cereales-sin-grasa', portions: 3 },
      { foodId: 'aoa-huevo', foodName: 'Huevo', group: 'aoa-bajo', portions: 2 },
      { foodId: 'aceite-oliva', foodName: 'Aceite', group: 'aceites-sin-proteina', portions: 1 },
    ]);
    expect(summary.catalogVersion).toBe(SMAE_CATALOG_VERSION);
    expect(summary.totals).toEqual({ kcal: 70 * 3 + 55 * 2 + 45, proteinG: 2 * 3 + 7 * 2 + 0, carbsG: 15 * 3 + 0 + 0, fatG: 0 + 2.5 * 2 + 5 });
    expect(summary.exchangesByGroup['cereales-sin-grasa']).toBe(3);
    expect(summary.entries).toHaveLength(3);
  });

  it('ignora ítems con grupo desconocido o porciones inválidas (fail-safe determinista)', () => {
    const summary = summarizeExchanges([
      { foodName: 'raro', group: 'grupo-inexistente', portions: 1 },
      { foodName: 'sin porcion', group: 'frutas', portions: 0 },
      { foodName: 'sin grupo', portions: 1 },
    ]);
    expect(summary.entries).toHaveLength(0);
    expect(summary.totals).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });

  it('valida un plan correcto dentro de tolerancia sin hallazgos de error', () => {
    const validation = validateMealPlan(
      [{ foodId: 'cereal-tortilla-maiz', group: 'cereales-sin-grasa', portions: 4 }, { foodId: 'aoa-huevo', group: 'aoa-bajo', portions: 2 }],
      { kcal: 390, proteinG: 22, carbsG: 60, fatG: 5 },
      10,
    );
    expect(validation.ok).toBe(true);
    expect(validation.summary?.totals.kcal).toBe(390);
  });

  it('detecta desviaciones fuera de tolerancia y grupos inválidos', () => {
    const validation = validateMealPlan(
      [{ group: 'cereales-sin-grasa', portions: 8 }, { group: 'fake', portions: 2 }],
      { kcal: 700, proteinG: 20, carbsG: 150, fatG: 0 },
      10,
    );
    expect(validation.ok).toBe(false);
    expect(validation.issues.some((i) => i.code === 'UNKNOWN_GROUP' && i.severity === 'error')).toBe(true);
    expect(validation.issues.some((i) => i.code === 'TARGET_DEVIATION')).toBe(true);
  });

  it('sugiere sustituciones dentro del mismo grupo excluyendo alergenos', () => {
    const { candidates, unmatched } = suggestSubstitutions('fruta-manzana', { allergenTexts: [], intoleranceTexts: [] });
    expect(unmatched).toBe(false);
    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(candidate.group).toBe('frutas');
    }
  });

  it('bloquea sustituciones que coinciden con alergias/intolerancias', () => {
    const allCandidates = suggestSubstitutions('leche-entera', { allergenTexts: [], intoleranceTexts: ['lactosa'] });
    const all = allCandidates.candidates.map((c) => c.name);
    expect(all.every((name) => !/lactosa|leche/i.test(name))).toBe(true);
    expect(all).toHaveLength(0);
  });

  it('reporta unmatched para alimentos fuera del catálogo', () => {
    const { candidates, unmatched } = suggestSubstitutions('alimento-custom', { allergenTexts: [], intoleranceTexts: [] });
    expect(unmatched).toBe(true);
    expect(candidates).toHaveLength(0);
  });

  it('equivalencia inversa por kcal: ~70 kcal → cereales primero', () => {
    const matches = findGroupsByKcal(70, 5);
    expect(matches[0].group).toBe('cereales-sin-grasa');
    expect(matches.some((m) => m.group === 'cereales-con-grasa')).toBe(true);
    expect(findGroupsByKcal(0, 10)).toEqual([]);
  });

  it('rechaza tolerancias negativas', () => {
    expect(() => findGroupsByKcal(70, -1)).toThrow('La tolerancia no puede ser negativa');
  });
});