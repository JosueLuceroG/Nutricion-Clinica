import { describe, it, expect } from "vitest";
import {
  bodyFatFromBMI,
  bodyFatFromDensity,
  bodyFatFrom3Skinfolds,
  bodyFatFrom7Skinfolds,
  leanMass,
  waistHipRatio,
  waistHipRisk,
  waistHeightRatio,
} from "./bodyComposition";

describe("bodyFatFromBMI (Deurenberg 1991)", () => {
  it("hombre 30 años BMI 25 → 20.7%", () => {
    const pct = bodyFatFromBMI({ bmi: 25, ageYears: 30, sex: "male" });
    expect(pct).toBeCloseTo(20.7, 1);
  });

  it("mujer 30 años BMI 25 → 31.5%", () => {
    const pct = bodyFatFromBMI({ bmi: 25, ageYears: 30, sex: "female" });
    expect(pct).toBeCloseTo(31.5, 1);
  });

  it("mujer tiene mayor % grasa que hombre con mismos datos", () => {
    const f = bodyFatFromBMI({ bmi: 28, ageYears: 40, sex: "female" });
    const m = bodyFatFromBMI({ bmi: 28, ageYears: 40, sex: "male" });
    expect(f).toBeGreaterThan(m);
  });

  it("rechaza BMI fuera de rango", () => {
    expect(() => bodyFatFromBMI({ bmi: 5, ageYears: 30, sex: "male" })).toThrow(RangeError);
    expect(() => bodyFatFromBMI({ bmi: 100, ageYears: 30, sex: "male" })).toThrow(RangeError);
  });

  it("rechaza edad fuera de rango", () => {
    expect(() => bodyFatFromBMI({ bmi: 25, ageYears: 3, sex: "male" })).toThrow(RangeError);
  });
});

describe("bodyFatFromDensity (Siri 1961)", () => {
  it("densidad 1.06 → ~17%", () => {
    expect(bodyFatFromDensity(1.06)).toBeCloseTo(17, 0);
  });

  it("densidad 1.10 → ~0%", () => {
    expect(bodyFatFromDensity(1.10)).toBe(0);
  });

  it("rechaza densidad fuera de rango", () => {
    expect(() => bodyFatFromDensity(0.5)).toThrow(RangeError);
    expect(() => bodyFatFromDensity(1.5)).toThrow(RangeError);
  });
});

describe("bodyFatFrom3Skinfolds (Jackson-Pollock 3)", () => {
  it("hombre 25 años, pliegues 10+12+15", () => {
    const pct = bodyFatFrom3Skinfolds({
      triceps: 10,
      subscapular: 12,
      suprailiac: 15,
      ageYears: 25,
      sex: "male",
    });
    expect(pct).toBeGreaterThan(5);
    expect(pct).toBeLessThan(30);
  });

  it("rechaza pliegues negativos", () => {
    expect(() =>
      bodyFatFrom3Skinfolds({
        triceps: -1,
        subscapular: 10,
        suprailiac: 15,
        ageYears: 25,
        sex: "male",
      }),
    ).toThrow(RangeError);
  });
});

describe("bodyFatFrom7Skinfolds (Jackson-Pollock 7)", () => {
  it("mujer 30 años pliegues moderados", () => {
    const pct = bodyFatFrom7Skinfolds({
      triceps: 15,
      biceps: 8,
      subscapular: 14,
      suprailiac: 16,
      abdominal: 18,
      thigh: 22,
      calf: 14,
      ageYears: 30,
      sex: "female",
    });
    expect(pct).toBeGreaterThan(15);
    expect(pct).toBeLessThan(40);
  });
});

describe("leanMass", () => {
  it("80 kg con 25% grasa → 60 kg magra", () => {
    expect(leanMass({ weightKg: 80, bodyFatPct: 25 })).toBe(60);
  });

  it("rechaza peso inválido", () => {
    expect(() => leanMass({ weightKg: 0, bodyFatPct: 20 })).toThrow(RangeError);
  });
});

describe("waistHipRatio", () => {
  it("ratio = 80/100 = 0.8", () => {
    expect(waistHipRatio(80, 100)).toBe(0.8);
  });
});

describe("waistHipRisk (criterios OMS/IDF)", () => {
  it("hombre con 0.85 → bajo (OMS: <0.90)", () => {
    expect(waistHipRisk(0.85, "male").level).toBe("low");
  });
  it("hombre con 0.92 → moderado (OMS: 0.90-0.95)", () => {
    expect(waistHipRisk(0.92, "male").level).toBe("moderate");
  });
  it("hombre con 1.05 → muy alto (OMS: ≥1.0)", () => {
    expect(waistHipRisk(1.05, "male").level).toBe("very-high");
  });
  it("mujer con 0.75 → bajo (OMS: <0.80)", () => {
    expect(waistHipRisk(0.75, "female").level).toBe("low");
  });
  it("mujer con 0.83 → moderado (OMS: 0.80-0.85)", () => {
    expect(waistHipRisk(0.83, "female").level).toBe("moderate");
  });
  it("mujer con 0.95 → muy alto (OMS: ≥0.90)", () => {
    expect(waistHipRisk(0.95, "female").level).toBe("very-high");
  });
});

describe("waistHeightRatio", () => {
  it("80 cm cintura, 170 cm altura → ~0.47", () => {
    expect(waistHeightRatio(80, 170)).toBeCloseTo(0.47, 2);
  });
});
