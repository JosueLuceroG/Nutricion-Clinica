import { describe, expect, it } from 'vitest';
import { ACTIVITY_FACTORS, assessCalculatorAvailability, calculateBmi, hydrationNeeds, maintenanceCalories, mifflinStJeor, proteinTarget, runCalculators, runCalculatorsDetailed } from './calculators.js';

describe('calculators', () => {
  it('classifies BMI categories deterministically', () => {
    expect(calculateBmi(50, 1.7).category).toBe('bajo_peso');
    expect(calculateBmi(68, 1.75).category).toBe('normal');
    expect(calculateBmi(80, 1.7).category).toBe('sobrepeso');
    expect(calculateBmi(95, 1.7).category).toBe('obesidad');
  });

  it('computes BMI with basis and rounded value', () => {
    const result = calculateBmi(70, 1.75);
    expect(result.value).toBe(22.9);
    expect(result.unit).toBe('kg/m2');
    expect(result.basis).toContain('1.75');
  });

  it('computes Mifflin-St Jeor for female and male', () => {
    const female = mifflinStJeor({ sex: 'femenino', weightKg: 60, heightM: 1.6, ageYears: 30 });
    const male = mifflinStJeor({ sex: 'masculino', weightKg: 80, heightM: 1.8, ageYears: 35 });
    expect(female.value).toBe(1289);
    expect(male.value).toBe(1755);
    expect(female.unit).toBe('kcal/dia');
  });

  it('computes maintenance calories from activity factors', () => {
    expect(ACTIVITY_FACTORS.sedentario).toBe(1.2);
    expect(ACTIVITY_FACTORS.muy_activo).toBe(1.9);
    const result = maintenanceCalories(1500, 'moderado');
    expect(result.value).toBe(2325);
    expect(result.basis).toContain('moderado=1.55');
  });

  it('computes hydration needs at 30 ml/kg', () => {
    const result = hydrationNeeds(70);
    expect(result.value).toBe(2.1);
    expect(result.unit).toBe('l/dia');
  });

  it('computes protein target with configurable factor', () => {
    expect(proteinTarget(70).value).toBe(84);
    expect(proteinTarget(70, 1.6).value).toBe(112);
  });

  it('runCalculators skips BMR-dependent results when sex or age is missing', () => {
    const partial = runCalculators({ weightKg: 70, heightM: 1.7, activity: 'moderado' });
    const ids = partial.map((c) => c.id);
    expect(ids).toContain('calc_bmi');
    expect(ids).toContain('calc_hydration');
    expect(ids).toContain('calc_protein');
    expect(ids).not.toContain('calc_bmr');
    expect(ids).not.toContain('calc_maintenance');
  });

  it('runCalculators includes BMR and maintenance when sex and age are present', () => {
    const full = runCalculators({ weightKg: 70, heightM: 1.7, sex: 'masculino', ageYears: 40, activity: 'activo' });
    const ids = full.map((c) => c.id);
    expect(ids).toContain('calc_bmr');
    expect(ids).toContain('calc_maintenance');
    expect(full.length).toBe(5);
  });

  it('todo resultado de calculadora lleva calculatorVersion (provenance)', () => {
    for (const calc of runCalculators({ weightKg: 70, heightM: 1.7, sex: 'femenino', ageYears: 35, activity: 'moderado' })) {
      expect(calc.calculatorVersion).toMatch(/^calc\.[a-z_]+\.v1$/);
    }
  });

  it('assessCalculatorAvailability reporta INSUFFICIENT_DATA cuando faltan campos', () => {
    const empty = assessCalculatorAvailability({});
    expect(empty.available).toBeNull();
    expect(empty.unavailable.map((u) => u.id)).toEqual(expect.arrayContaining(['calc_bmi', 'calc_bmr', 'calc_hydration', 'calc_protein']));
    expect(empty.unavailable.every((u) => u.reason === 'INSUFFICIENT_DATA')).toBe(true);

    const partial = assessCalculatorAvailability({ weightKg: 70 });
    expect(partial.available).toEqual(['calc_hydration', 'calc_protein']);
    expect(partial.unavailable.find((u) => u.id === 'calc_bmi')?.missingFields).toEqual(['heightM']);
  });

  it('runCalculatorsDetailed nunca invoca calculadoras sin datos suficientes', () => {
    const { results, unavailable } = runCalculatorsDetailed({ weightKg: 70, activity: 'moderado' });
    const ids = results.map((r) => r.id);
    expect(ids).toEqual(['calc_hydration', 'calc_protein']);
    expect(unavailable.some((u) => u.id === 'calc_bmi')).toBe(true);

    const full = runCalculatorsDetailed({ weightKg: 70, heightM: 1.7, sex: 'femenino', ageYears: 35, activity: 'moderado' });
    expect(full.results.map((r) => r.id)).toEqual(['calc_bmi', 'calc_bmr', 'calc_maintenance', 'calc_hydration', 'calc_protein']);
    expect(full.unavailable).toHaveLength(0);
  });
});