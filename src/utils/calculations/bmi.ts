/**
 * BMI — Body Mass Index.
 *
 * BMI = peso (kg) / altura (m)²
 *
 * Categorías OMS para adultos (≥20 años):
 *   - Bajo peso:        < 18.5
 *   - Normal:           18.5 – 24.9
 *   - Sobrepeso:        25.0 – 29.9
 *   - Obesidad I:       30.0 – 34.9
 *   - Obesidad II:      35.0 – 39.9
 *   - Obesidad III:     ≥ 40.0
 *
 * Para menores de 20 años, los puntos de corte son por edad y sexo
 * (percentiles). Esta función solo clasifica adultos.
 */
export type BMICategory =
  | "underweight"
  | "normal"
  | "overweight"
  | "obesity-i"
  | "obesity-ii"
  | "obesity-iii";

export const BMICategoryLabel: Record<BMICategory, string> = {
  underweight: "Bajo peso",
  normal: "Normal",
  overweight: "Sobrepeso",
  "obesity-i": "Obesidad I",
  "obesity-ii": "Obesidad II",
  "obesity-iii": "Obesidad III",
};

export const BMICategoryColor: Record<BMICategory, string> = {
  underweight: "info",
  normal: "success",
  overweight: "warning",
  "obesity-i": "warning",
  "obesity-ii": "destructive",
  "obesity-iii": "destructive",
};

export interface BMIInput {
  weightKg: number;
  heightM: number;
}

export interface BMIResult {
  value: number;
  category: BMICategory;
  isAdult: boolean;
}

export const calculateBMI = ({ weightKg, heightM }: BMIInput): BMIResult => {
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new RangeError("El peso debe ser un número positivo.");
  }
  if (!Number.isFinite(heightM) || heightM <= 0) {
    throw new RangeError("La altura debe ser un número positivo.");
  }
  if (heightM < 0.5 || heightM > 2.5) {
    throw new RangeError("La altura debe estar entre 0.5 m y 2.5 m.");
  }
  if (weightKg < 1 || weightKg > 500) {
    throw new RangeError("El peso debe estar entre 1 kg y 500 kg.");
  }

  const value = weightKg / (heightM * heightM);
  return {
    value: round(value, 2),
    category: classifyBMI(value),
    isAdult: true,
  };
};

export const classifyBMI = (bmi: number): BMICategory => {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  if (bmi < 35) return "obesity-i";
  if (bmi < 40) return "obesity-ii";
  return "obesity-iii";
};

const round = (n: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
};
