import type { Anthropometry } from "../domain/Anthropometry";
import { bodyFatFromBMI } from "@utils/calculations/bodyComposition";
import { classifyBMI, type BMICategory } from "@utils/calculations/bmi";

export interface TrendPoint {
  date: Date;
  weightKg: number;
  bmi: number;
  bmiCategory: BMICategory;
  waistCm: number | null;
  bodyFatPct: number | null;
}

export interface TrendAnalysis {
  points: TrendPoint[];
  weightChange: number;
  weightChangePct: number;
  bmiChange: number;
  daysSpan: number;
  velocityKgPerWeek: number;
}

export function analyzeTrend(measurements: Anthropometry[]): TrendAnalysis {
  const sorted = [...measurements].sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime());
  const points: TrendPoint[] = sorted.map((m) => ({
    date: m.measuredAt,
    weightKg: m.weight.toKg(),
    bmi: m.bmi,
    bmiCategory: classifyBMI(m.bmi),
    waistCm: m.circumferences.waist?.toCm() ?? null,
    bodyFatPct: m.bia?.bodyFatPct ?? null,
  }));

  if (points.length < 2) {
    return { points, weightChange: 0, weightChangePct: 0, bmiChange: 0, daysSpan: 0, velocityKgPerWeek: 0 };
  }

  const first = points[0];
  const last = points[points.length - 1];
  const daysSpan = (last.date.getTime() - first.date.getTime()) / (1000 * 60 * 60 * 24);
  const weightChange = last.weightKg - first.weightKg;
  const weightChangePct = first.weightKg > 0 ? (weightChange / first.weightKg) * 100 : 0;
  const bmiChange = last.bmi - first.bmi;
  const velocityKgPerWeek = daysSpan > 0 ? (weightChange / daysSpan) * 7 : 0;

  return { points, weightChange, weightChangePct, bmiChange, daysSpan, velocityKgPerWeek };
}

export interface BodyFatComparison {
  deurenbergPct: number;
  bmi: number;
  skinfoldSumMm: number;
}

export function compareBodyFatMethods(m: Anthropometry, ageYears: number, sex: "male" | "female"): BodyFatComparison {
  return {
    deurenbergPct: bodyFatFromBMI({ bmi: m.bmi, ageYears, sex }),
    bmi: m.bmi,
    skinfoldSumMm: m.sumOfSkinfolds,
  };
}
