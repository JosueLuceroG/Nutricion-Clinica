/**
 * Cálculos de composición corporal.
 *
 * Implementa los modelos más usados en consulta nutricional adulta:
 *
 *  1. **% grasa por BMI** (Deurenberg et al., 1991)
 *     %fat = (1.20 × BMI) + (0.23 × age) − (10.8 × sex) − 5.4
 *     donde sex: masculino=1, femenino=0
 *     Rango: 18-70 años, BMI 15-40.
 *
 *  2. **% grasa por sumatoria de 3 pliegues** (Jackson-Pollock-Ward 3)
 *     Sitios: tríceps + subescapular + suprailiaco.
 *
 *  3. **% grasa por sumatoria de 7 pliegues** (Jackson-Pollock 7)
 *     Sitios: tríceps, bíceps, subescapular, suprailiaco, abdominal, muslo, pantorrilla.
 *
 *  4. **% grasa desde densidad corporal** (Siri, 1961)
 *     %fat = (495 / density) − 450
 *
 *  5. **Masa magra** (kg)
 *     leanMass = weight × (1 − %fat/100)
 *
 *  6. **Relación cintura-cadera (RCC)** y **cintura-estatura (RCE)**
 *     RCC = waist / hip
 *     RCE = waist / height
 *
 *  7. **Masa muscular** (kg) — estimación por Lee et al. (2000) usando
 *     circunferencias corregidas por pliegue cutáneo.
 *
 * Referencias:
 *  - Deurenberg P, Weststrate JA, Seidell JC. Br J Nutr 1991;65(2):105-114.
 *  - Jackson AS, Pollock ML, Ward A. Med Sci Sports Exerc 1980;12(3):175-181.
 *  - Siri WE. Techniques for measuring body composition. 1961.
 *  - Lee RC et al. J Appl Physiol 2000;89(1):145-150.
 */
import type { Sex } from "@modules/patient/domain/Sex";

export type SexBinary = Exclude<Sex, "intersex" | "undisclosed">;

const sexToBinary = (sex: SexBinary): 1 | 0 => (sex === "male" ? 1 : 0);

export interface DeurenbergInput {
  bmi: number;
  ageYears: number;
  sex: SexBinary;
}

export const bodyFatFromBMI = ({ bmi, ageYears, sex }: DeurenbergInput): number => {
  if (!Number.isFinite(bmi) || bmi < 10 || bmi > 60) {
    throw new RangeError("BMI fuera de rango plausible (10-60).");
  }
  if (ageYears < 7 || ageYears > 100) {
    throw new RangeError("Edad fuera de rango (7-100 años).");
  }
  const s = sexToBinary(sex);
  const pct = 1.2 * bmi + 0.23 * ageYears - 10.8 * s - 5.4;
  return round(clampPct(pct));
};

export const bodyFatFromDensity = (density: number): number => {
  if (!Number.isFinite(density) || density < 0.9 || density > 1.2) {
    throw new RangeError("Densidad corporal fuera de rango (0.9-1.2 g/mL).");
  }
  return round(clampPct((495 / density) - 450));
};

export interface JacksonPollock3Input {
  triceps: number;
  subscapular: number;
  suprailiac: number;
  ageYears: number;
  sex: SexBinary;
}

export const bodyFatFrom3Skinfolds = (input: JacksonPollock3Input): number => {
  validateSkinfolds([input.triceps, input.subscapular, input.suprailiac]);
  const sum = input.triceps + input.subscapular + input.suprailiac;
  let density: number;
  if (input.sex === "male") {
    density = 1.10938 - 0.0008267 * sum + 0.0000016 * sum * sum - 0.0002574 * input.ageYears;
  } else {
    density = 1.0994921 - 0.0009929 * sum + 0.0000023 * sum * sum - 0.0001392 * input.ageYears;
  }
  return bodyFatFromDensity(density);
};

export interface JacksonPollock7Input {
  triceps: number;
  biceps: number;
  subscapular: number;
  suprailiac: number;
  abdominal: number;
  thigh: number;
  calf: number;
  ageYears: number;
  sex: SexBinary;
}

export const bodyFatFrom7Skinfolds = (input: JacksonPollock7Input): number => {
  validateSkinfolds([
    input.triceps,
    input.biceps,
    input.subscapular,
    input.suprailiac,
    input.abdominal,
    input.thigh,
    input.calf,
  ]);
  const sum = input.triceps + input.biceps + input.subscapular + input.suprailiac + input.abdominal + input.thigh + input.calf;
  let density: number;
  if (input.sex === "male") {
    density = 1.112 - 0.00043499 * sum + 0.00000055 * sum * sum - 0.00028826 * input.ageYears;
  } else {
    density = 1.097 - 0.00046971 * sum + 0.00000056 * sum * sum - 0.00012828 * input.ageYears;
  }
  return bodyFatFromDensity(density);
};

export interface LeanMassInput {
  weightKg: number;
  bodyFatPct: number;
}

export const leanMass = ({ weightKg, bodyFatPct }: LeanMassInput): number => {
  if (weightKg <= 0) throw new RangeError("El peso debe ser positivo.");
  if (bodyFatPct < 0 || bodyFatPct > 80) {
    throw new RangeError("% grasa fuera de rango.");
  }
  return round(weightKg * (1 - bodyFatPct / 100));
};

export const waistHipRatio = (waistCm: number, hipCm: number): number => {
  if (waistCm <= 0 || hipCm <= 0) {
    throw new RangeError("Circunferencias deben ser positivas.");
  }
  return round(waistCm / hipCm, 2);
};

export type WHRiskLevel = "low" | "moderate" | "high" | "very-high";

export interface WHRisk {
  ratio: number;
  level: WHRiskLevel;
}

export const waistHipRisk = (ratio: number, sex: SexBinary): WHRisk => {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    throw new RangeError("Ratio cintura-cadera inválido.");
  }
  let level: WHRiskLevel;
  if (sex === "male") {
    if (ratio < 0.9) level = "low";
    else if (ratio < 0.95) level = "moderate";
    else if (ratio < 1.0) level = "high";
    else level = "very-high";
  } else {
    if (ratio < 0.8) level = "low";
    else if (ratio < 0.85) level = "moderate";
    else if (ratio < 0.9) level = "high";
    else level = "very-high";
  }
  return { ratio, level };
};

export const waistHeightRatio = (waistCm: number, heightCm: number): number => {
  if (waistCm <= 0 || heightCm <= 0) {
    throw new RangeError("Valores deben ser positivos.");
  }
  return round(waistCm / heightCm, 2);
};

export const WHtRLevel = (ratio: number): "low" | "moderate" | "high" => {
  if (ratio < 0.4) return "low";
  if (ratio < 0.5) return "moderate";
  if (ratio < 0.6) return "high";
  return "high";
};

const validateSkinfolds = (values: number[]): void => {
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0 || v > 80) {
      throw new RangeError("Pliegues fuera de rango (0-80 mm).");
    }
  }
};

const clampPct = (n: number): number => Math.max(0, Math.min(80, n));

const round = (n: number, decimals = 1): number => {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
};
