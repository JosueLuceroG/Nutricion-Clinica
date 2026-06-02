/**
 * BMR — Basal Metabolic Rate.
 *
 * Implementa las dos fórmulas más usadas en consulta nutricional:
 *  - Mifflin-St Jeor (1990) — recomendada por la Academia de Nutrición y Dietética.
 *  - Harris-Benedict (1919, revisada por Roza & Shizgal, 1984).
 *
 * Mifflin-St Jeor:
 *   Hombres:  10*peso + 6.25*altura - 5*edad + 5
 *   Mujeres:  10*peso + 6.25*altura - 5*edad - 161
 *
 * Harris-Benedict revisada:
 *   Hombres:  88.362 + 13.397*peso + 4.799*altura - 5.677*edad
 *   Mujeres:  447.593 + 9.247*peso + 3.098*altura - 4.330*edad
 *
 * Unidades: peso en kg, altura en cm, edad en años. Resultado en kcal/día.
 */
import type { Sex } from "@modules/patient/domain/Sex";

export type BMRFormula = "mifflin-st-jeor" | "harris-benedict";

export const BMRFormulaLabel: Record<BMRFormula, string> = {
  "mifflin-st-jeor": "Mifflin-St Jeor",
  "harris-benedict": "Harris-Benedict (revisada)",
};

export interface BMRInput {
  sex: Exclude<Sex, "intersex" | "undisclosed">;
  weightKg: number;
  heightCm: number;
  ageYears: number;
}

export interface BMRResult {
  value: number;
  formula: BMRFormula;
}

const assertPositive = (n: number, field: string): void => {
  if (!Number.isFinite(n) || n <= 0) {
    throw new RangeError(`${field} debe ser un número positivo.`);
  }
};

const assertNonNegative = (n: number, field: string): void => {
  if (!Number.isFinite(n) || n < 0) {
    throw new RangeError(`${field} debe ser un número no negativo.`);
  }
};

const assertRange = (n: number, min: number, max: number, field: string): void => {
  if (n < min || n > max) {
    throw new RangeError(`${field} debe estar entre ${min} y ${max}.`);
  }
};

const validateBMRInput = (input: BMRInput): void => {
  assertPositive(input.weightKg, "El peso");
  assertPositive(input.heightCm, "La altura");
  assertNonNegative(input.ageYears, "La edad");
  assertRange(input.weightKg, 1, 500, "El peso");
  assertRange(input.heightCm, 30, 250, "La altura");
  assertRange(input.ageYears, 0, 130, "La edad");
};

export const calculateBMR = (input: BMRInput, formula: BMRFormula = "mifflin-st-jeor"): BMRResult => {
  validateBMRInput(input);
  const value =
    formula === "mifflin-st-jeor"
      ? mifflinStJeor(input)
      : harrisBenedict(input);
  return { value: Math.round(value), formula };
};

const mifflinStJeor = ({ sex, weightKg, heightCm, ageYears }: BMRInput): number => {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return sex === "male" ? base + 5 : base - 161;
};

const harrisBenedict = ({ sex, weightKg, heightCm, ageYears }: BMRInput): number => {
  if (sex === "male") {
    return 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * ageYears;
  }
  return 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * ageYears;
};

/**
 * Devuelve el cálculo con ambas fórmulas para mostrar en consulta.
 */
export const calculateBMRBoth = (input: BMRInput): Record<BMRFormula, BMRResult> => {
  return {
    "mifflin-st-jeor": calculateBMR(input, "mifflin-st-jeor"),
    "harris-benedict": calculateBMR(input, "harris-benedict"),
  };
};
