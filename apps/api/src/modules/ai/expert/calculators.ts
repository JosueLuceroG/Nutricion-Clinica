export type BmiCategory = 'bajo_peso' | 'normal' | 'sobrepeso' | 'obesidad';

export interface CalculatorResult {
  id: string;
  name: string;
  value: number;
  unit: string;
  basis: string;
  /** Versión reproducible de la fórmula/regla. Cambios → requalification. */
  calculatorVersion: string;
}

export interface BmiResult extends CalculatorResult {
  value: number;
  category: BmiCategory;
}

export const CALCULATOR_VERSIONS = {
  bmi: 'calc.bmi.v1',
  bmr: 'calc.bmr.v1',
  maintenance: 'calc.maintenance.v1',
  hydration: 'calc.hydration.v1',
  protein: 'calc.protein.v1',
} as const;

export interface UnavailableCalculator {
  id: string;
  reason: 'INSUFFICIENT_DATA';
  missingFields: string[];
}

export function calculateBmi(weightKg: number, heightM: number): BmiResult {
  const bmi = weightKg / (heightM * heightM);
  const rounded = Math.round(bmi * 10) / 10;
  const category: BmiCategory = rounded < 18.5 ? 'bajo_peso' : rounded < 25 ? 'normal' : rounded < 30 ? 'sobrepeso' : 'obesidad';
  return {
    id: 'calc_bmi',
    name: 'Indice de masa corporal',
    value: rounded,
    unit: 'kg/m2',
    category,
    basis: `BMI = peso(${weightKg} kg) / talla^2(${heightM} m)`,
    calculatorVersion: CALCULATOR_VERSIONS.bmi,
  };
}

export type Sex = 'femenino' | 'masculino';

export function mifflinStJeor(input: {
  sex: Sex;
  weightKg: number;
  heightM: number;
  ageYears: number;
}): CalculatorResult {
  const bmr = input.sex === 'femenino' ? 10 * input.weightKg + 6.25 * input.heightM * 100 - 5 * input.ageYears - 161 : 10 * input.weightKg + 6.25 * input.heightM * 100 - 5 * input.ageYears + 5;
  return {
    id: 'calc_bmr',
    name: 'Metabolismo basal (Mifflin-St Jeor)',
    value: Math.round(bmr),
    unit: 'kcal/dia',
    basis: `Mifflin-St Jeor (${input.sex}): 10*peso + 6.25*talla_cm - 5*edad + ajuste`,
    calculatorVersion: CALCULATOR_VERSIONS.bmr,
  };
}

export type ActivityLevel = 'sedentario' | 'ligero' | 'moderado' | 'activo' | 'muy_activo';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentario: 1.2,
  ligero: 1.375,
  moderado: 1.55,
  activo: 1.725,
  muy_activo: 1.9,
};

export function maintenanceCalories(bmr: number, activity: ActivityLevel): CalculatorResult {
  const factor = ACTIVITY_FACTORS[activity];
  return {
    id: 'calc_maintenance',
    name: 'Calorias de mantenimiento',
    value: Math.round(bmr * factor),
    unit: 'kcal/dia',
    basis: `TMB(${bmr}) * factor_actividad(${activity}=${factor})`,
    calculatorVersion: CALCULATOR_VERSIONS.maintenance,
  };
}

export function hydrationNeeds(weightKg: number): CalculatorResult {
  const ml = weightKg * 30;
  return {
    id: 'calc_hydration',
    name: 'Requerimiento de hidratacion',
    value: Math.round(ml) / 1000,
    unit: 'l/dia',
    basis: `30 ml/kg de peso(${weightKg} kg)`,
    calculatorVersion: CALCULATOR_VERSIONS.hydration,
  };
}

export function proteinTarget(weightKg: number, factor = 1.2): CalculatorResult {
  return {
    id: 'calc_protein',
    name: 'Objetivo de proteina',
    value: Math.round(weightKg * factor * 10) / 10,
    unit: 'g/dia',
    basis: `peso(${weightKg} kg) * factor(${factor} g/kg)`,
    calculatorVersion: CALCULATOR_VERSIONS.protein,
  };
}

/**
 * Disponibilidad determinista de cada calculadora. Una calculadora con
 * datos insuficientes se reporta como INSUFFICIENT_DATA y NUNCA se invoca.
 */
export function assessCalculatorAvailability(input: {
  weightKg?: number;
  heightM?: number;
  sex?: Sex;
  ageYears?: number;
}): { available: CalculatorResult['id'][] | null; unavailable: UnavailableCalculator[] } {
  const hasWeight = typeof input.weightKg === 'number' && input.weightKg > 0;
  const hasHeight = typeof input.heightM === 'number' && input.heightM > 0;
  const hasSex = input.sex === 'femenino' || input.sex === 'masculino';
  const hasAge = typeof input.ageYears === 'number' && input.ageYears > 0;

  const unavailable: UnavailableCalculator[] = [];
  const available: CalculatorResult['id'][] = [];
  const mark = (id: CalculatorResult['id'], ok: boolean, missingFields: string[]): void => {
    if (ok) {
      available.push(id);
    } else {
      unavailable.push({ id, reason: 'INSUFFICIENT_DATA', missingFields });
    }
  };

  mark('calc_bmi', hasWeight && hasHeight, hasWeight ? ['heightM'] : ['weightKg', 'heightM']);
  mark('calc_bmr', hasWeight && hasHeight && hasSex && hasAge, ['weightKg', 'heightM', 'sex', 'ageYears'].filter((f) => !(f === 'weightKg' ? hasWeight : f === 'heightM' ? hasHeight : f === 'sex' ? hasSex : hasAge)));
  mark('calc_maintenance', hasWeight && hasHeight && hasSex && hasAge, ['weightKg', 'heightM', 'sex', 'ageYears'].filter((f) => !(f === 'weightKg' ? hasWeight : f === 'heightM' ? hasHeight : f === 'sex' ? hasSex : hasAge)));
  mark('calc_hydration', hasWeight, hasWeight ? [] : ['weightKg']);
  mark('calc_protein', hasWeight, hasWeight ? [] : ['weightKg']);

  return { available: available.length > 0 ? available : null, unavailable };
}

export function runCalculators(input: {
  weightKg: number;
  heightM: number;
  sex?: Sex;
  ageYears?: number;
  activity: ActivityLevel;
}): CalculatorResult[] {
  const results: CalculatorResult[] = [calculateBmi(input.weightKg, input.heightM)];
  if (input.sex && input.ageYears !== undefined) {
    results.push(mifflinStJeor({ sex: input.sex, weightKg: input.weightKg, heightM: input.heightM, ageYears: input.ageYears }));
    results.push(maintenanceCalories(results[results.length - 1].value, input.activity));
  }
  results.push(hydrationNeeds(input.weightKg));
  results.push(proteinTarget(input.weightKg));
  return results;
}

/**
 * Versión de `runCalculators` que respeta la disponibilidad determinista:
 * solo ejecuta las calculadoras viables y reporta INSUFFICIENT_DATA para el resto.
 */
export function runCalculatorsDetailed(input: {
  weightKg?: number;
  heightM?: number;
  sex?: Sex;
  ageYears?: number;
  activity: ActivityLevel;
}): { results: CalculatorResult[]; unavailable: UnavailableCalculator[] } {
  const { available, unavailable } = assessCalculatorAvailability(input);
  if (!available) return { results: [], unavailable };
  const results: CalculatorResult[] = [];
  if (available.includes('calc_bmi')) results.push(calculateBmi(input.weightKg!, input.heightM!));
  if (available.includes('calc_bmr')) results.push(mifflinStJeor({ sex: input.sex!, weightKg: input.weightKg!, heightM: input.heightM!, ageYears: input.ageYears! }));
  if (available.includes('calc_maintenance') && results.some((r) => r.id === 'calc_bmr')) {
    results.push(maintenanceCalories(results.find((r) => r.id === 'calc_bmr')!.value, input.activity));
  }
  if (available.includes('calc_hydration')) results.push(hydrationNeeds(input.weightKg!));
  if (available.includes('calc_protein')) results.push(proteinTarget(input.weightKg!));
  return { results, unavailable };
}