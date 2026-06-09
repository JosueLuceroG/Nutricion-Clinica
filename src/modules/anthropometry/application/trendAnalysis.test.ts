import { describe, it, expect } from "vitest";
import { analyzeTrend, compareBodyFatMethods } from "./trendAnalysis";
import { Anthropometry } from "../domain/Anthropometry";
import { PatientId } from "@modules/patient/domain/PatientId";
import { Weight, Height, Circumference, Skinfold } from "../domain/Measurements";

const pid = PatientId.generate();

const createMeasurement = (weightKg: number, date: Date, overrides: Partial<{
  heightCm: number;
  waistCm: number;
  bodyFatPct: number;
  tricepsMm: number;
  bicepsMm: number;
  subscapularMm: number;
}> = {}) => {
  return Anthropometry.create({
    patientId: pid,
    measuredAt: date,
    weight: Weight.fromKg(weightKg),
    height: Height.fromCentimeters(overrides.heightCm ?? 170),
    circumferences: overrides.waistCm ? { waist: Circumference.fromCm(overrides.waistCm) } : {},
    skinfolds: overrides.tricepsMm ? {
      triceps: Skinfold.fromMm(overrides.tricepsMm),
      biceps: Skinfold.fromMm(overrides.bicepsMm ?? overrides.tricepsMm),
      subscapular: Skinfold.fromMm(overrides.subscapularMm ?? overrides.tricepsMm),
    } : {},
  });
};

describe("analyzeTrend", () => {
  it("retorna points vacío y cambios en cero para array vacío", () => {
    const result = analyzeTrend([]);
    expect(result.points).toHaveLength(0);
    expect(result.weightChange).toBe(0);
    expect(result.weightChangePct).toBe(0);
    expect(result.bmiChange).toBe(0);
    expect(result.daysSpan).toBe(0);
    expect(result.velocityKgPerWeek).toBe(0);
  });

  it("retorna cambios en cero para una sola medición", () => {
    const m = createMeasurement(80, new Date("2024-06-01"));
    const result = analyzeTrend([m]);
    expect(result.points).toHaveLength(1);
    expect(result.weightChange).toBe(0);
    expect(result.daysSpan).toBe(0);
  });

  it("ordena mediciones por fecha aunque lleguen desordenadas", () => {
    const m1 = createMeasurement(80, new Date("2024-06-01"));
    const m2 = createMeasurement(82, new Date("2024-07-01"));
    const m3 = createMeasurement(81, new Date("2024-05-01"));
    const result = analyzeTrend([m1, m2, m3]);
    expect(result.points[0].date.getTime()).toBe(new Date("2024-05-01").getTime());
    expect(result.points[2].date.getTime()).toBe(new Date("2024-07-01").getTime());
  });

  it("detecta tendencia ascendente de peso", () => {
    const m1 = createMeasurement(75, new Date("2024-01-01"));
    const m2 = createMeasurement(78, new Date("2024-02-01"));
    const result = analyzeTrend([m1, m2]);
    expect(result.weightChange).toBe(3);
    expect(result.weightChangePct).toBeCloseTo(4, 0);
    expect(result.velocityKgPerWeek).toBeCloseTo(3 / 31 * 7, 1);
  });

  it("detecta tendencia descendente de peso", () => {
    const m1 = createMeasurement(85, new Date("2024-01-01"));
    const m2 = createMeasurement(80, new Date("2024-04-01"));
    const result = analyzeTrend([m1, m2]);
    expect(result.weightChange).toBe(-5);
    expect(result.weightChangePct).toBeCloseTo(-5.88, 1);
  });

  it("detecta estabilidad con valores iguales", () => {
    const m1 = createMeasurement(70, new Date("2024-01-01"));
    const m2 = createMeasurement(70, new Date("2024-03-01"));
    const result = analyzeTrend([m1, m2]);
    expect(result.weightChange).toBe(0);
    expect(result.weightChangePct).toBe(0);
  });

  it("calcula bmiChange correctamente", () => {
    const m1 = createMeasurement(80, new Date("2024-01-01"), { heightCm: 170 });
    const m2 = createMeasurement(76, new Date("2024-06-01"), { heightCm: 170 });
    const result = analyzeTrend([m1, m2]);
    const bmi1 = 80 / (1.7 * 1.7);
    const bmi2 = 76 / (1.7 * 1.7);
    expect(result.bmiChange).toBeCloseTo(bmi2 - bmi1, 2);
  });

  it("incluye waistCm y bodyFatPct en points cuando están presentes", () => {
    const m1 = createMeasurement(80, new Date("2024-01-01"), { waistCm: 90 });
    const result = analyzeTrend([m1]);
    expect(result.points[0].waistCm).toBe(90);
    expect(result.points[0].bodyFatPct).toBeNull();
  });

  it("incluye bmiCategory en cada point", () => {
    const m1 = createMeasurement(60, new Date("2024-01-01"), { heightCm: 170 });
    const result = analyzeTrend([m1]);
    expect(result.points[0].bmiCategory).toBe("normal");
  });
});

describe("compareBodyFatMethods", () => {
  it("retorna deurenbergPct, bmi y skinfoldSumMm", () => {
    const m = createMeasurement(70, new Date(), { heightCm: 165, tricepsMm: 12, bicepsMm: 8, subscapularMm: 15 });
    const result = compareBodyFatMethods(m, 30, "female");
    expect(result.bmi).toBeCloseTo(70 / (1.65 * 1.65), 1);
    expect(result.skinfoldSumMm).toBe(35);
    expect(result.deurenbergPct).toBeGreaterThan(0);
  });

  it("deurenbergPct es mayor en mujeres que hombres con mismo BMI", () => {
    const m = createMeasurement(70, new Date(), { heightCm: 170 });
    const female = compareBodyFatMethods(m, 30, "female");
    const male = compareBodyFatMethods(m, 30, "male");
    expect(female.deurenbergPct).toBeGreaterThan(male.deurenbergPct);
  });

  it("aumenta con la edad para el mismo BMI", () => {
    const m = createMeasurement(70, new Date(), { heightCm: 170 });
    const younger = compareBodyFatMethods(m, 25, "female");
    const older = compareBodyFatMethods(m, 50, "female");
    expect(older.deurenbergPct).toBeGreaterThan(younger.deurenbergPct);
  });

  it("reporta skinfoldSumMm en 0 cuando no hay pliegues", () => {
    const m = createMeasurement(70, new Date(), { heightCm: 170 });
    const result = compareBodyFatMethods(m, 30, "female");
    expect(result.skinfoldSumMm).toBe(0);
  });
});
