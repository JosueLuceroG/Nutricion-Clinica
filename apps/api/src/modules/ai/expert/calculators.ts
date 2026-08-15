export type BmiCategory = 'bajo_peso' | 'normal' | 'sobrepeso' | 'obesidad';

export interface CalculatorResult {
  id: string;
  name: string;
  value: number;
  unit: string;
  basis: string;
}

export interface BmiResult extends CalculatorResult {
  value: number;
  category: BmiCategory;
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
  };
}

export function proteinTarget(weightKg: number, factor = 1.2): CalculatorResult {
  return {
    id: 'calc_protein',
    name: 'Objetivo de proteina',
    value: Math.round(weightKg * factor * 10) / 10,
    unit: 'g/dia',
    basis: `peso(${weightKg} kg) * factor(${factor} g/kg)`,
  };
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